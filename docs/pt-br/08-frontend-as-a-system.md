# 08 — Frontend como Parte do Sistema Distribuído

> O cliente não é uma UI burra. Ele participa do sistema distribuído: mantém estado, reconcilia com o servidor, trata falhas e mantém consistência localmente.

**Staff/Principal:** O cliente é um nó do sistema. Definir responsabilidades do frontend (otimista, reconciliação, dedup) antes de implementar evita conflitos de estado e bugs difíceis de rastrear.

---

## 1. Papel do frontend

O frontend é um **nó** no sistema. Ele:

- Mantém estado local que pode divergir do servidor
- Envia e recebe por canal não confiável (WebSocket pode cair)
- Deve reconciliar estado local e do servidor sem perder mensagens ou quebrar ordem
- Permite UX rápida (atualizações otimistas) preservando correção

**Fronteira:** O servidor é fonte da verdade para mensagens, ordem e membership. O cliente é fonte da verdade para estado de conexão, cursor e rascunhos otimistas.

**Repository layer:** Chamadas à API (WebSocket, HTTP de backfill) devem ir por camada de repositório (`lib/repositories/` ou equivalente). A UI nunca chama `fetch` ou `axios` direto. Interface define o contrato; adapter implementa. Ver [Frontend Architecture Playbook](https://frontend-architecture-playbook-eight.vercel.app/).

**Estrutura ao implementar:** Use organização feature-based. Dependency Rule: camadas externas usam internas; domínio não importa UI. ADR obrigatório para framework, build e deploy. Ver `.cursor/rules/frontend-architecture-playbook.mdc`.

---

## 2. Atualizações otimistas

### 2.1 O quê e por quê

Quando o usuário envia uma mensagem, mostre-a **imediatamente** na UI. Não espere ack do servidor. Latência parece zero; o chat "simplesmente funciona".

### 2.2 Fluxo prático

```
Usuário clica Enviar
  → Cliente cria mensagem otimista (temp_id, content, sender=eu, sequence=pending)
  → Anexar à lista local de mensagens
  → Renderizar imediatamente
  → Enviar ao servidor com idempotency_key
  → Em ack: substituir otimista pela mensagem do servidor (message_id, sequence)
  → Em erro: marcar falhou; mostrar UI de retry; opcionalmente rollback da lista
```

### 2.3 Estrutura de dados para mensagem otimista

```ts
// Otimista: sem message_id ou sequence ainda
type OptimisticMessage = {
  temp_id: string;        // uuid, gerado pelo cliente
  content: string;
  sender_id: string;
  conversation_id: string;
  status: 'pending' | 'acked' | 'failed';
};

// Mensagem do servidor: autoritativa
type ServerMessage = {
  message_id: string;
  sequence: number;
  content: string;
  sender_id: string;
  conversation_id: string;
  timestamp: string;
};
```

### 2.4 Substituir em ack

Quando o ack chega, casar por `idempotency_key` ou `temp_id` (se você enviou). Substituir a mensagem otimista pela mensagem do servidor. A mensagem do servidor tem `message_id` e `sequence`; inserir na posição correta por sequence (geralmente no fim se você acabou de enviar).

### 2.5 Rollback em falha

Se envio falhar após retries:

- **Opção A:** Manter mensagem na lista com `status: 'failed'`; mostrar "Falha ao enviar" e botão de retry.
- **Opção B:** Remover da lista; mostrar toast "Mensagem falhou. Toque para retentar."

Opção A é melhor para chat: usuário vê sua mensagem e pode retentar sem redigitar.

### 2.6 Ordenação de mensagens otimistas

Mensagens otimistas não têm sequence. Colocá-las no **fim** da lista (são as mais recentes). Quando o ack chega, o servidor pode atribuir sequence que as encaixa entre mensagens existentes (race: outro usuário enviou enquanto isso). Substituir pela mensagem do servidor; reordenar por sequence. A mensagem do servidor tem a posição correta.

---

## 3. Estado local vs estado do servidor

### 3.1 O que o cliente mantém

| Estado | Dono | Propósito |
|--------|-----|-----------|
| `messages[conversation_id]` | Cliente (derivado do servidor) | Mensagens a exibir; ordenadas por sequence |
| `cursor[conversation_id]` | Cliente | Última sequence vista; usado para backfill |
| `seen_message_ids` | Cliente | Set de message_ids; para dedup |
| `optimistic_messages` | Cliente | Envios pendentes; substituídos em ack |
| `connection_status` | Cliente | connected / disconnected / reconnecting |
| `subscribed_conversations` | Cliente | Quais conversas receber push |

### 3.2 O que o servidor mantém (fonte da verdade)

| Estado | Dono | Cliente confia |
|--------|-----|----------------|
| Mensagens, sequence, ordem | Servidor | Sim |
| Membership | Servidor | Sim |
| Conteúdo da mensagem | Servidor | Sim |

### 3.3 Pontos de divergência

| Cenário | Local à frente do servidor | Servidor à frente do local |
|---------|---------------------------|----------------------------|
| Envio otimista | Cliente mostra mensagem; servidor não ackou | N/A |
| Após desconexão | Cliente tem cursor obsoleto | Servidor tem novas mensagens |
| Push vs backfill | Cliente pode ter algumas do push | Backfill preenche lacunas |
| Mensagem atrasada | Raro: mensagem com seq < max chega | Cliente insere em ordem |

**Regra:** Estado local pode ser otimista (à frente) ou obsoleto (atrás). Estado do servidor é sempre referência para reconciliação.

---

## 4. Estratégias de reconciliação

### 4.1 Três fontes de mensagens

Mensagens chegam ao cliente por:

1. **Inserção otimista** : Usuário enviou; adicionamos localmente antes do ack.
2. **Push** : Mensagem em tempo real do servidor para conversa que inscrevemos.
3. **Backfill** : Requisição ao conectar/reconectar; servidor retorna chunk por cursor.

Reconciliação = mesclar sem duplicatas, na ordem correta.

### 4.2 Algoritmo de merge (prático)

```ts
function mergeMessage(
  state: MessageState,
  incoming: ServerMessage | OptimisticMessage
): void {
  if (isServerMessage(incoming)) {
    if (state.seenIds.has(incoming.message_id)) return; // dedup
    state.seenIds.add(incoming.message_id);
    insertBySequence(state.messages, incoming);
    state.cursor = Math.max(state.cursor, incoming.sequence);
  } else {
    state.messages.push(incoming); // otimista no fim
  }
}

function insertBySequence(messages: Message[], msg: ServerMessage): void {
  const idx = messages.findIndex(m => 
    isServerMessage(m) && m.sequence > msg.sequence
  );
  if (idx === -1) messages.push(msg);
  else messages.splice(idx, 0, msg);
}
```

### 4.3 Substituir otimista em ack

```ts
function onAck(ack: { message_id: string; sequence: number }, temp_id: string): void {
  const idx = state.messages.findIndex(m => m.temp_id === temp_id);
  if (idx === -1) return; // raro: já substituído?
  const optimistic = state.messages[idx];
  const serverMsg: ServerMessage = {
    message_id: ack.message_id,
    sequence: ack.sequence,
    content: optimistic.content,
    sender_id: optimistic.sender_id,
    conversation_id: optimistic.conversation_id,
    timestamp: new Date().toISOString()
  };
  state.messages[idx] = serverMsg;
  state.seenIds.add(serverMsg.message_id);
  state.cursor = Math.max(state.cursor, ack.sequence);
  // Reordenar se necessário (geralmente não; ack é da nossa mensagem)
  sortBySequence(state.messages);
}
```

### 4.4 Merge de backfill

Backfill retorna mensagens com `sequence > cursor`. Estão ordenadas. Mesclar:

```ts
function mergeBackfill(messages: ServerMessage[]): void {
  for (const msg of messages) {
    mergeMessage(state, msg);
  }
}
```

Dedup dentro de `mergeMessage` trata qualquer sobreposição (ex.: cursor estava errado e já tínhamos algumas).

### 4.5 Merge de push

Igual ao backfill: `mergeMessage(state, pushedMessage)`. Push pode chegar enquanto backfill está em andamento; ambos caminhos usam o mesmo merge. Dedup garante sem exibição duplicada.

---

## 5. Tratamento de duplicatas

### 5.1 Quando duplicatas ocorrem

- Push e backfill retornam a mesma mensagem (cursor defasado ou race de reconnect)
- At-least-once: servidor pode entregar mesma mensagem duas vezes
- Caminhos de retry: retries do cliente ou servidor podem causar recebimento duplicado

### 5.2 Estratégia de dedup

**Antes de adicionar qualquer mensagem à lista de exibição, verificar `message_id`:**

```ts
if (state.seenIds.has(message.message_id)) {
  return; // já temos
}
state.seenIds.add(message.message_id);
```

### 5.3 Limitando o conjunto seen

`seenIds` cresce sem limite se nunca evictarmos. Opções:

| Estratégia | Como | Trade-off |
|------------|-----|-----------|
| **Manter últimos N** | Podar message_ids fora das últimas 1000 (ou 7 dias) | Simples; duplicata muito antiga poderia reaparecer (raro) |
| **Por conversa** | Um set por conversa; podar ao aparar histórico na UI | Combina com uso; duplicata entre convs impossível |
| **Bloom filter** | Eficiente em espaço; pequena chance de falso positivo | Complexo; geralmente exagero |

**Recomendação:** Set por conversa; podar quando evictar mensagens da memória (ex.: quando usuário rola para longe de mensagens antigas e você aparar).

### 5.4 Otimista e dedup

Mensagens otimistas têm `temp_id`, não `message_id`. Não são deduplicadas (são únicas por temp_id). Quando o ack chega, substituímos; a mensagem do servidor recebe `message_id` e entra no conjunto seen.

---

## 6. Tratamento de problemas de ordenação

### 6.1 Servidor impõe ordem

O servidor atribui sequence. Push e backfill entregam mensagens em ordem de sequence. O cliente não deveria precisar "corrigir" ordem : mas deve tratar edge cases.

### 6.2 Edge cases

| Caso | O que acontece | Ação do cliente |
|------|----------------|-----------------|
| **Push atrasado** | Mensagem com seq 10 chega depois da seq 11 | Inserir por sequence; colocar 10 antes de 11 |
| **Preenchimento de lacuna no backfill** | Cliente tem 9, 11; backfill retorna 10 | Inserir 10 entre 9 e 11 |
| **Otimista depois ack** | Nossa mensagem ackada com seq 12; outro enviou 11 | Inserir mensagem do servidor na posição 12; reordenar |
| **Rede fora de ordem** | WebSocket entrega 11 antes de 10 | Inserir cada por sequence; resultado correto |

### 6.3 Sempre ordenar por sequence

Nunca confiar na ordem de chegada. Sempre manter mensagens ordenadas por `sequence`:

```ts
messages.sort((a, b) => a.sequence - b.sequence);
```

Executar após qualquer merge (ou usar estrutura que mantém ordem, ex.: lista ordenada ou insert-by-sequence como acima).

### 6.4 Ordenação de mensagem otimista

Mensagens otimistas não têm sequence. Opções:

- **Colocar no fim:** Assumir que nossa mensagem é a mais recente. Quando ack chega, substituir; sequence do servidor vai encaixá-la (pode ser antes de outras se enviaram enquanto estávamos em flight).
- **Colocar com seq placeholder:** Usar `Sequence.MAX` ou `Infinity` para ordenar no fim. Substituir em ack pela sequence real.

### 6.5 Cursor e lacunas

Se o cliente tem seq 9 e 11, cursor deveria ser 9 (não podemos avançar para 11 sem 10). Opções:

- **Cursor = max sequence contígua:** Cursor avança apenas quando não temos lacunas. Requisições de backfill `after_sequence=cursor`.
- **Cursor = max sequence vista:** Mais simples. Cursor = 11. Backfill `after_sequence=11` perde 10. Então precisamos detecção de lacuna: se temos lacuna, solicitar backfill com `after_sequence=min_gap_start`.

**Recomendação:** Cursor = max sequence recebida. Se detectarmos lacuna (ex.: temos 9 e 11), solicitar `backfill(after_sequence=9)`. Servidor retorna 10. Mesclar. Sem lacuna.

---

## 7. Checklist prático

| Tarefa | Implementação |
|--------|---------------|
| **Envio otimista** | Adicionar à lista em Enviar; substituir em ack; mostrar estado de falha em erro |
| **Substituir em ack** | Casar por temp_id/idempotency_key; trocar por mensagem do servidor |
| **Dedup** | Verificar message_id antes de adicionar; manter seenIds por conversa |
| **Ordem** | Sempre inserir por sequence; ordenar após merge |
| **Merge de backfill** | Iterar sobre chunk; mergeMessage cada |
| **Merge de push** | mergeMessage cada |
| **Cursor** | Persistir last_seen_sequence; usar para backfill; atualizar a cada nova mensagem |
| **Reconnect** | Backoff; backfill de cada conversa inscrita; merge; dedup |

---

## 8. Máquina de estados (conexão)

```
                    ┌─────────────┐
                    │ disconnected│
                    └──────┬──────┘
                           │ connect
                           ▼
                    ┌─────────────┐
                    │ connecting  │
                    └──────┬──────┘
              ┌────────────┼────────────┐
              │ fail       │ success    │
              ▼            ▼            │
       ┌─────────────┐ ┌─────────────┐  │
       │ reconnecting│ │ connected   │◄─┘
       └──────┬──────┘ └──────┬──────┘
              │               │ disconnect/timeout
              └───────────────┘
```

- **disconnected:** Inicial; ou após desistir de reconnect.
- **connecting:** Primeira conexão ou reconnect manual.
- **connected:** WebSocket aberto; recebendo push; pode enviar.
- **reconnecting:** Conexão perdida; backoff; retry.

Na transição para **connected**, executar backfill das conversas inscritas. Em **reconnecting**, preservar estado local; não limpar mensagens.

---

## Documentos relacionados

- [03 — Trade-offs](./03-trade-offs.md) (Responsabilidades frontend vs backend)
- [05 — Modelo de Mensagens](./05-messaging-model.md)
- [07 — Cenários de Falha](./07-failure-scenarios.md)
