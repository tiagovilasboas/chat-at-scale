# 05 — Modelo de Mensagens

> Semântica central de entrega, ordenação, retries e tratamento offline. Este documento define o contrato entre cliente e servidor.

**Staff/Principal:** O contrato de mensagens deve estar definido antes de qualquer implementação. Cliente e servidor precisam concordar em at-least-once, ordenação e backfill. Sem isso, integrações futuras pagam o preço.

---

## 1. Garantia de entrega: at-least-once

### Escolha: **At-least-once**

Toda mensagem persistida é entregue pelo menos uma vez a cada participante. Duplicatas podem ocorrer; perda não.

### Semântica precisa

| Evento | Significado |
|--------|-------------|
| **Ack ao remetente** | Mensagem está persistida. Será entregue a todos participantes (online agora ou ao reconectar). |
| **Entregue ao destinatário** | Destinatário recebeu a mensagem (via push ou backfill). Destinatário pode receber a mesma mensagem novamente (duplicata). |
| **At-least-once** | Para cada par (mensagem, participante): o participante recebe a mensagem ≥ 1 vez. O participante deduplica por message ID. |

### Justificativa

- **INV-004, INV-005:** Sem perda silenciosa; toda mensagem persistida chega a todo participante.
- **Simplicidade vs exactly-once:** Exactly-once exige dedup server-side antes do fan-out, rastreamento de entrega idempotente e coordenação. Para chat, dedup no cliente é aceitável.
- **Dedup no cliente:** INV-003 (IDs únicos imutáveis) permite deduplicação confiável no cliente. Exibição duplicada é problema menor de UX; perda é crítica.

### Fora do escopo

- **At-most-once:** Viola invariantes; mensagens podem ser perdidas.
- **Exactly-once:** Otimização futura; at-least-once não bloqueia.

---

## 2. Estratégia de ordenação de mensagens

### Escolha: **Ordem total por conversa, sequence atribuída pelo servidor**

### Mecanismo

1. **Single sequencer por conversa:** Um escritor (ou shard) atribui números de sequence. Sem consenso distribuído por mensagem.
2. **Sequence monotônico:** Cada mensagem recebe `sequence` = previous_max + 1 para aquela conversa.
3. **Ordem canônica:** Mensagens são ordenadas por `(conversation_id, sequence)`. Todos participantes observam a mesma ordem.
4. **Contrato com o cliente:** Cliente recebe mensagens com `sequence`; exibe em ordem ascendente; usa `sequence` como cursor para backfill.

### Atribuição de sequence

```
conversation_id | sequence | message_id | sender_id | content
----------------|----------|------------|-----------|--------
conv_1          | 1        | msg_abc    | user_A    | "olá"
conv_1          | 2        | msg_def    | user_B    | "oi"
conv_1          | 3        | msg_ghi    | user_A    | "tchau"
```

- `sequence` é atribuído no momento da persistência, em ordem de commit.
- `message_id` é ID único imutável (UUID ou similar); usado para dedup.
- `sequence` é a chave de ordenação; `message_id` é a chave de identidade.

### Justificativa

- **INV-008:** Mesma ordem total para todos participantes.
- **INV-014:** Histórico monotônico; backfill retorna mensagens ordenadas por sequence.
- **Escalabilidade:** Um sequencer por conversa; conversas são independentes. Escalar particionando conversas.

### Ordem entre conversas

Sem garantia de ordem entre conversas. A visão do usuário A de conv_1 e conv_2 pode ter intercalação arbitrária. Ordem por conversa é suficiente para chat.

---

## 3. Estratégia de retry

### 3.1 Retry do remetente (cliente → servidor)

| Aspecto | Comportamento |
|---------|---------------|
| **Gatilho** | Sem ack dentro do timeout (ex.: 5s); ou conexão fechada antes do ack |
| **Ação** | Cliente retenta o mesmo envio |
| **Idempotência** | Cliente envia `idempotency_key` (UUID) com cada envio. Servidor: se chave vista e sucesso retornado antes, retorna ack em cache (mesmo message_id, mesma sequence). Se não vista, processa e armazena chave com mensagem. |
| **Max retries** | Definido pelo cliente (ex.: 5). Após exaustão, expor erro; usuário pode retentar manualmente. |
| **Backoff** | Exponential backoff entre retries (ex.: 1s, 2s, 4s, 8s, 16s) |

**Escopo da idempotency key:** Por ação de envio. Uma chave por "usuário clica em enviar". Retries reutilizam a mesma chave.

### 3.2 Retry de persistência (servidor)

| Aspecto | Comportamento |
|---------|---------------|
| **Gatilho** | Escrita no DB falha (timeout, erro de conexão) |
| **Ação** | Retry com exponential backoff (ex.: 100ms, 200ms, 400ms, 800ms) |
| **Max retries** | 3–5. Após exaustão, retornar erro ao cliente. Cliente pode retentar (com mesma idempotency key). |
| **Sem ack antes de persistir** | Nunca retornar sucesso até persistir com sucesso. INV-007. |

### 3.3 Retry de fan-out (servidor → clientes conectados)

| Aspecto | Comportamento |
|---------|---------------|
| **Gatilho** | Push ao Gateway falha (ex.: conexão fechada, erro de escrita) |
| **Ação** | Sem retry server-side para o mesmo push. |
| **Recuperação** | Cliente reconectará; backfill na conexão retorna todas as mensagens perdidas. At-least-once é satisfeito via backfill. |
| **Racional** | Retentar push arrisca entrega duplicada (cliente pode ter recebido antes da falha). Cliente deduplica. Mais simples não retentar; backfill é o caminho de recuperação. |

### Resumo

| Tipo de retry | Quem retenta | Idempotência | Caminho de recuperação |
|---------------|--------------|--------------|-------------------------|
| Send (sem ack) | Cliente | idempotency_key | Retentar com mesma chave; servidor retorna ack em cache ou processa |
| Persistência | Servidor | N/A | Retentar; falhar para cliente; cliente retenta envio |
| Fan-out | Nenhum | N/A | Reconnect do cliente + backfill |

---

## 4. Abordagem de deduplicação

### 4.1 Server-side (idempotência do remetente)

| Quando | Como |
|--------|-----|
| Cliente envia com mesmo `idempotency_key` duas vezes | Primeira: persistir, atribuir id+seq, ack. Segunda: retornar mesmo ack (sem nova mensagem). |
| Storage | Armazenar `idempotency_key → (message_id, sequence)` para envios bem-sucedidos. TTL: 24h (ou suficiente para janela de retry). |

Evita mensagens duplicadas de retries do remetente. Um envio lógico = uma mensagem.

### 4.2 Client-side (deduplicação do receptor)

| Quando | Como |
|--------|-----|
| Cliente recebe mensagem (push ou backfill) | Antes de exibir, verificar se `message_id` já está no store local. Se sim, descartar. Se não, adicionar e exibir. |
| Storage | Cliente mantém set ou map de `message_id` por conversa. Limitado pelo histórico da conversa (ex.: últimas N mensagens ou últimos 7 dias). |

Evita exibição duplicada. Entrega at-least-once pode produzir duplicatas (ex.: sobreposição push + backfill, ou retry futuro de fan-out); cliente deduplica.

### 4.3 Sobreposição: push e backfill

Quando o cliente reconecta, pode ter recebido algumas mensagens via push antes da desconexão, e outras apenas via backfill. Backfill retorna mensagens com `sequence > cursor`. Se cursor é inclusivo do último push, sem sobreposição. Se cursor é exclusivo e usamos `after_sequence`:

- Cliente envia `backfill(conv, after_sequence=last_seen)`.
- Servidor retorna mensagens com `sequence > last_seen`.
- Mensagens com `sequence <= last_seen` foram recebidas via push ou são lacunas (perdidas durante desconexão). Para lacunas: cliente deve enviar `after_sequence=last_seen` e servidor retorna a partir de `last_seen + 1`. Se cliente rastreia `last_seen` como max sequence recebida, então `after_sequence=last_seen` significa "me dê tudo após last_seen". Servidor retorna `WHERE sequence > last_seen`. Sem sobreposição. Bom.

**Semântica do cursor:** `cursor` = maior `sequence` que o cliente recebeu para aquela conversa. Requisição de backfill: `after_sequence=cursor`. Servidor retorna mensagens com `sequence > cursor`, ordenadas por sequence, limit N.

---

## 5. Tratamento de usuários offline

### 5.1 Definição de "offline"

Usuário não tem conexão WebSocket ativa ao Gateway.

### 5.2 Armazenamento de mensagens

Todas as mensagens são persistidas antes do ack (write-through). Mensagens de usuários offline ficam na Persistência. Nenhuma entrega apenas in-memory.

### 5.3 Entrega a usuários offline

| Quando | Como |
|--------|-----|
| Usuário envia mensagem enquanto destinatário offline | Mensagem persistida. Destinatário está no membership; mensagem está "pendente" para ele. |
| Destinatário conecta depois | Ao conectar, cliente envia backfill para cada conversa que importa. |
| Backfill | `GET /backfill?conversation_id=X&after_sequence=Y&limit=100` (ou equivalente via WebSocket). Servidor retorna mensagens com `sequence > Y`, ordenadas. |
| Cursor | Cliente rastreia `last_seen_sequence` por conversa. Após conectar, `after_sequence=0` (ou último conhecido se cliente tem estado obsoleto). |

### 5.4 Protocolo de backfill

```
Cliente                           Servidor
   |                                |
   |  connect                       |
   |  subscribe(conv_1, conv_2)    |
   |------------------------------->|
   |                                |
   |  backfill(conv_1, after=0, limit=50)
   |------------------------------->|
   |  messages[1..50]               |
   |<-------------------------------|
   |  backfill(conv_2, after=0, limit=50)
   |------------------------------->|
   |  messages[1..50]               |
   |<-------------------------------|
   |                                |
   |  (push em tempo real para novas mensagens)
   |<-------------------------------|
```

- **Carga inicial:** `after=0` retorna primeiras N mensagens.
- **Reconnect:** `after=last_seen_sequence` retorna mensagens perdidas durante desconexão.
- **Paginação:** Se mais de `limit` perdidas, cliente solicita próxima página: `after=last_received_sequence`.

### 5.5 Garantias para usuários offline

| Garantia | Mecanismo |
|----------|-----------|
| Sem perda de mensagem | Todas mensagens persistidas; backfill serve histórico |
| Mesma ordem | Backfill retorna mensagens ordenadas por sequence (INV-014) |
| Consistência | Após backfill completar, cliente tem prefixo da conversa consistente com servidor |
| Sem lacuna permanente | Backfill baseado em cursor garante que todas mensagens com `sequence > cursor` são eventualmente buscadas |

### 5.6 Offline prolongado

Usuários offline por dias: backfill pode retornar muitas mensagens. Cliente pode paginar (limit=100 por requisição) ou suportar "carregar mais" na UI. Servidor não expira mensagens (ou expiração é política separada); backfill sempre retorna o que existe.

---

## 6. Identidade e estrutura da mensagem

### Campos atribuídos pelo servidor (apenas servidor escreve)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `message_id` | string (UUID) | Único, imutável. Nunca reutilizado. |
| `sequence` | int64 | Monotônico por conversa. Chave de ordenação. |
| `timestamp` | timestamp | Relógio do servidor na persistência. Para exibição; não para ordenação. |

### Campos fornecidos pelo cliente (enviados pelo cliente)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `idempotency_key` | string (UUID) | Obrigatório para envio. Deduplica retries. |
| `conversation_id` | string | Conversa alvo. |
| `content` | string | Corpo da mensagem (texto). |
| `sender_id` | string | Definido pelo servidor a partir do auth; cliente não deve sobrescrever. |

### Mensagem completa (como entregue)

```json
{
  "message_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "conv_123",
  "sequence": 42,
  "sender_id": "user_abc",
  "content": "Olá",
  "timestamp": "2025-03-23T10:00:00Z"
}
```

---

## 7. Resumo

| Aspecto | Decisão |
|---------|---------|
| **Entrega** | At-least-once; sem perda; cliente deduplica duplicatas |
| **Ordenação** | Ordem total por conversa; sequence atribuída pelo servidor |
| **Retry do remetente** | Cliente retenta com idempotency_key; servidor retorna ack em cache em duplicata |
| **Retry de persistência** | Servidor retenta com backoff; nunca ack antes de persistir |
| **Retry de fan-out** | Sem retry; backfill no reconnect |
| **Deduplicação** | Servidor: idempotency_key no envio. Cliente: message_id no recebimento. |
| **Offline** | Todas mensagens persistidas; backfill por cursor (after_sequence) ao conectar |

---

## Documentos relacionados

- [01 — Definição do Problema](./01-problem-definition.md)
- [02 — Invariantes do Sistema](./02-system-invariants.md)
- [03 — Trade-offs](./03-trade-offs.md)
- [04 — Arquitetura](./04-architecture.md)
