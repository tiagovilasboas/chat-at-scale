# 07 — Cenários de Falha e Recuperação

> Modos de falha e como o sistema detecta, trata e se recupera deles.

---

## 1. Cliente offline

### 1.1 Cenário

Usuário não tem conexão WebSocket ativa. Mensagens são enviadas para conversas das quais participa enquanto está offline.

### 1.2 Efeito

- **Remetente:** Recebe ack normalmente. Sem mudança.
- **Destinatário offline:** Não recebe push. Mensagens acumulam na Persistência.
- **Outros participantes:** Recebem mensagens normalmente via push.

### 1.3 Estratégia de recuperação

| Passo | Ator | Ação |
|-------|-----|------|
| 1 | Cliente | Usuário abre app ou recupera rede; cliente estabelece conexão WebSocket |
| 2 | Cliente | Cliente envia requisição de backfill por conversa inscrita: `backfill(conversation_id, after_sequence=cursor, limit=N)` |
| 3 | Servidor | Retorna mensagens com `sequence > cursor`, ordenadas por sequence |
| 4 | Cliente | Mescla mensagens no store local; deduplica por `message_id`; atualiza cursor |
| 5 | Cliente | Se resposta tem `limit` mensagens, cliente solicita próxima página: `after_sequence=last_received_sequence` |

**Cursor:** Cliente persiste `last_seen_sequence` por conversa (em memória ou local storage). Em conexão nova, `cursor=0`. Em reconnect, `cursor=last_seen_sequence` de antes da desconexão.

### 1.4 Garantias

- **INV-006:** Todas mensagens enviadas enquanto offline estão disponíveis ao reconectar.
- **INV-014:** Backfill retorna sequence monotônica; sem lacunas.
- **Sem perda de mensagem:** Persistência write-through garante que toda mensagem acked está armazenada.

---

## 2. Reconexão

### 2.1 Cenário

Cliente estava conectado; conexão cai (instabilidade de rede, restart do Gateway, sleep do cliente). Cliente reconecta.

### 2.2 Efeito

- Mensagens enviadas durante a janela de desconexão não foram empurradas para este cliente.
- Cliente pode ter estado parcial (algumas mensagens recebidas antes da queda, outras não).
- Cursor pode estar obsoleto: cliente pode não saber exatamente qual sequence foi última recebida se a queda foi abrupta.

### 2.3 Estratégia de recuperação

| Passo | Ator | Ação |
|-------|-----|------|
| 1 | Cliente | Detectar desconexão (timeout de heartbeat, fechamento WebSocket). |
| 2 | Cliente | Iniciar reconnect com exponential backoff (1s, 2s, 4s, 8s, 16s, max 60s). |
| 3 | Cliente | Ao reconectar, re-autenticar; re-inscrever em conversas. |
| 4 | Cliente | Para cada conversa, solicitar backfill com `after_sequence=last_seen_sequence`. Usar 0 se desconhecido (ex.: crash). |
| 5 | Servidor | Retornar mensagens com `sequence > last_seen_sequence`, ordenadas. |
| 6 | Cliente | Mesclar, dedup por message_id, atualizar cursor. Retomar push em tempo real. |

### 2.4 Tratamento de cursor em desconexão abrupta

Se cliente crashar ou conexão fechar sem shutdown gracioso, `last_seen_sequence` pode ser perdido. Opções:

| Opção | Comportamento | Trade-off |
|-------|---------------|-----------|
| **Persistir cursor** | Cliente grava cursor no local storage a cada mensagem. Sobrevive ao crash. | Overhead leve; possível leve obsolescência se escrita falhar |
| **Cursor conservador** | Ao reconectar com estado desconhecido, usar `after_sequence=0` ou último conhecido. Pode buscar algumas duplicatas. | Cliente deduplica; seguro |
| **Assistido pelo servidor** | Servidor rastreia última sequence entregue por usuário por conversa. Cliente pergunta "o que tenho?" | Mais estado no servidor; útil para multi-dispositivo |

**Recomendação:** Persistir cursor quando possível. Fallback para conservador (ex.: último conhecido da sessão) ou backfill completo de 0 se sem cursor. Cliente deduplica duplicatas.

### 2.5 Thundering herd (reconnect em massa)

Muitos clientes reconectam ao mesmo tempo (ex.: após indisponibilidade do Gateway).

| Risco | Clientes atingem backfill e Persistência concorrentemente; sobrecarga do DB. |
|-------|---------------------------------------------------------------------------------|
| Mitigação | Jitter no cliente: adicionar atraso aleatório (0–2s) antes do primeiro backfill. Escalonar requisições. |
| Mitigação | Rate limit de backfill por usuário ou por conversa no servidor. |
| Mitigação | Backfill de read replicas se disponível; reduzir carga na primary. |

---

## 3. Duplicação de mensagens

### 3.1 Cenários que causam duplicatas

| Fonte | Quando | Causa |
|-------|--------|-------|
| **Retry do remetente** | Cliente envia; sem ack; retenta com mesma idempotency_key | Servidor deduplica; nenhuma mensagem duplicada criada. |
| **Retry do remetente (bug)** | Cliente retenta sem idempotency_key | Servidor cria mensagem duplicada. Raro se cliente correto. |
| **Sobreposição push + backfill** | Cliente recebe algumas via push; desconecta; backfill retorna mesmas mensagens | Cursor deveria prevenir; se cursor errado, sobreposição possível. |
| **Retry de fan-out (futuro)** | Se adicionarmos retry de push server-side | Cliente pode receber mesma mensagem duas vezes. |
| **Múltiplos dispositivos (futuro)** | Mesmo usuário em dois clientes | Cada um recebe seu push; poderia ver mesma mensagem duas vezes se não sincronizado. |

### 3.2 Estratégia de recuperação: server-side (remetente)

| Mecanismo | Comportamento |
|-----------|---------------|
| **Idempotency key** | Cliente envia `idempotency_key` por envio. Servidor armazena `idempotency_key → (message_id, sequence)` para envios bem-sucedidos. Retry com mesma chave retorna ack em cache; sem nova mensagem. |
| **TTL** | Mapeamento de idempotência expira após 24h (ou janela de retry). Retries antigos criam nova mensagem; aceitar raro edge case. |

Resultado: Um envio lógico = uma mensagem. Sem duplicata de retries do remetente.

### 3.3 Estratégia de recuperação: client-side (receptor)

| Mecanismo | Comportamento |
|-----------|---------------|
| **Dedup por message_id** | Antes de exibir uma mensagem, cliente verifica se `message_id` existe no store local. Se sim, descartar. Se não, adicionar e exibir. |
| **Escopo** | Por conversa. Cliente mantém set/map de message_ids para mensagens recentes. Limitado (ex.: últimos 7 dias ou últimas 10k mensagens). |
| **Ordem** | Exibir por sequence; dedup apenas evita exibição duplicada. Ordem preservada. |

Resultado: Entrega at-least-once pode produzir duplicatas; cliente nunca mostra duas vezes.

---

## 4. Mensagens fora de ordem

### 4.1 Cenários que poderiam causar fora de ordem

| Fonte | Probabilidade | Causa |
|-------|---------------|-------|
| **Design do servidor** | Impedido | Servidor atribui sequence na persistência; um escritor por conversa. Ordem é canônica. |
| **Reordenação na rede** | Baixa | WebSocket é ordenado. Se múltiplas conexões, cliente deve usar uma. |
| **Intercalação backfill + push** | Possível | Cliente recebe push (seq 11); depois backfill retorna (seq 9, 10). Se aplicado na ordem de recebimento, exibição errada. |
| **Bug no cliente** | Possível | Cliente mescla incorretamente; exibe antes de dedup/merge. |

### 4.2 Prevenção (servidor)

- **Single sequencer por conversa:** Sequence atribuído na persistência, em ordem de commit. Sem fora de ordem do servidor.
- **Backfill ordenado:** Servidor retorna mensagens com `ORDER BY sequence ASC`. Monotônico.
- **Ordem do push:** Gateway empurra na ordem do fan-out; Messaging processa mensagens em ordem de sequence.

### 4.3 Estratégia de recuperação: cliente

| Mecanismo | Comportamento |
|-----------|---------------|
| **Sempre ordenar por sequence** | Cliente mantém mensagens em estrutura ordenada por sequence. Ao exibir, renderizar em ordem de sequence. |
| **Mesclar backfill corretamente** | Quando backfill retorna mensagens, mesclar por sequence na lista existente. Não anexar no fim. |
| **Tratar mensagens atrasadas** | Se mensagem chega com sequence < max_seen (ex.: push atrasado), inserir na posição correta. Atualizar cursor apenas quando contíguo a partir do cursor. |
| **Semântica do cursor** | `cursor` = maior sequence tal que todas mensagens com sequence ≤ cursor foram recebidas. Cursor avança apenas sem lacuna. |

**Edge case:** Mensagem com seq 10 chega depois da seq 11. Cliente insere 10 antes de 11. Exibição correta. Cursor permanece 11 (temos 10 e 11; sem lacuna).

### 4.4 Detecção de lacuna (opcional)

Se cliente tem seq 9 e 11, lacuna em 10. Cliente pode solicitar `backfill(conv, after_sequence=9, limit=10)` para preencher. Servidor retorna 10. Cliente mescla. Útil para desconexões longas ou perda suspeita.

---

## 5. Falhas parciais

### 5.1 Falha do Gateway (nó ou processo)

| Cenário | Uma ou mais instâncias do Gateway crasham ou ficam indisponíveis. |
|---------|------------------------------------------------------------------|
| Efeito | Clientes conectados àquele Gateway perdem conexão. Sem push até reconnect. |
| Impacto no remetente | Se remetente estava no Gateway falho, envio in-flight pode não receber ack. Cliente retenta com idempotency_key. |
| Impacto no destinatário | Offline durante o período. Reconnect a Gateway diferente (LB roteia para nó saudável). Backfill recupera. |

**Recuperação:**

| Passo | Ator | Ação |
|-------|-----|------|
| 1 | Cliente | Detectar desconexão (timeout de heartbeat, close). |
| 2 | Cliente | Reconectar; LB roteia para Gateway saudável. |
| 3 | Cliente | Backfill de mensagens perdidas. |
| 4 | Operadores | Reiniciar Gateway falho; escalar se necessário. |

**Sticky sessions:** Após reconnect, cliente pode cair em Gateway diferente. Session store (se usado) atualizado ao conectar. Messaging pode rotear ao novo Gateway.

### 5.2 Falha do sistema de mensagens

| Cenário | Processo(s) de Messaging crasham ou travam. |
|---------|-------------------------------------------|
| Efeito | Envios não processados. Sem acks. Sem fan-out. Persistência não escrita para novas mensagens. |
| In-flight | Mensagens no buffer do Gateway podem ser perdidas se ainda não encaminhadas. Cliente retenta. |

**Recuperação:**

| Passo | Ator | Ação |
|-------|-----|------|
| 1 | Cliente | Sem ack; retentar com idempotency_key. |
| 2 | Gateway | Pode enfileirar ou descartar. Se descartar, retry do cliente é único caminho. |
| 3 | Operadores | Reiniciar Messaging. Em escala, múltiplas instâncias; broker redistribui. |
| 4 | Persistência | Não afetada; mensagens existentes disponíveis. Sem perda de dados para mensagens persistidas. |

### 5.3 Falha da persistência

| Cenário | DB indisponível (crash, partição de rede, sobrecarga). |
|---------|--------------------------------------------------------|
| Efeito | Messaging não consegue persistir. Sem ack. Write-through bloqueia. |
| Cliente | Sem ack; retenta. |

**Recuperação:**

| Passo | Ator | Ação |
|-------|-----|------|
| 1 | Messaging | Retentar escrita no DB com backoff. Após max retries, retornar erro ao cliente. |
| 2 | Cliente | Recebe erro; retenta envio com idempotency_key. |
| 3 | Operadores | Restaurar DB; corrigir partição; escalar. |
| 4 | Read replicas | Se primary down, backfill falha. Degradar: permitir leituras de réplica obsoleta com aviso, ou retornar 503. |

**Invariante:** Nunca ack antes de persistir (INV-007). Então sem perda silenciosa mesmo em falha da persistência.

### 5.4 Partição de rede (cliente ↔ servidor)

| Cenário | Cliente perde conectividade com servidor (queda Wi‑Fi, handoff mobile). |
|---------|------------------------------------------------------------------------|
| Efeito | WebSocket fecha. Cliente aparece offline. |
| Recuperação | Igual à reconexão. Cliente reconecta quando rede restaurada; backfill. |

### 5.5 Partição de rede (componentes do servidor)

| Cenário | Gateway consegue alcançar cliente mas não Messaging. Ou Messaging não consegue alcançar Persistência. |
|---------|-----------------------------------------------------------------------------------------------------|
| Efeito | Falha parcial. Depende de qual perna está quebrada. |
| Gateway ↔ Messaging | Envios falham em chegar ao Messaging. Sem ack. Cliente retenta. |
| Messaging ↔ Persistência | Retry de persistência esgota; erro para cliente. Cliente retenta. |
| Messaging ↔ Gateway | Fan-out falha. Sem retry no servidor. Destinatários reconectam; backfill. |

### 5.6 Fan-out parcial (alguns destinatários perdem push)

| Cenário | Mensagem persistida; fan-out empurra para N destinatários. Push para destinatário R falha (conexão fechada, timeout). |
|---------|------------------------------------------------------------------------------------------------------------------------|
| Efeito | R não recebe push. Mensagem está na Persistência. |
| Recuperação | Sem retry no servidor. R reconecta (ou conecta); backfill retorna a mensagem. At-least-once satisfeito. |

### 5.7 Resumo: matriz de recuperação de falha parcial

| Falha | Remetente | Destinatário | Recuperação |
|-------|-----------|--------------|-------------|
| Gateway down | Retentar; reconnect a nó saudável | Reconnect; backfill | Dirigida pelo cliente |
| Messaging down | Retentar; sem ack até subir | N/A (sem novas mensagens) | Reiniciar Messaging |
| Persistência down | Retentar; erro até subir | Backfill funciona se Persistência up | Restaurar DB |
| Push falha | N/A | Reconnect; backfill | Dirigida pelo cliente |
| Partição de rede | Retentar quando restaurada | Reconnect; backfill | Dirigida pelo cliente |

---

## 6. Checklist de recuperação

| Cenário | Detecção | Recuperação | Dono |
|---------|----------|-------------|------|
| Cliente offline | Sem conexão | Backfill ao conectar | Cliente |
| Reconexão | Timeout de heartbeat, WS close | Backoff, reconnect, backfill | Cliente |
| Retry do remetente (sem ack) | Timeout | Retentar com idempotency_key | Cliente |
| Duplicata (receptor) | message_id visto | Dedup antes de exibir | Cliente |
| Fora de ordem | sequence usado para ordenar | Mesclar por sequence; ordenar na exibição | Cliente |
| Falha do Gateway | Conexão perdida | Reconnect ao LB; backfill | Cliente + Ops |
| Falha do Messaging | Sem ack | Retentar; reiniciar serviço | Cliente + Ops |
| Falha da Persistência | Erro de escrita | Retentar; restaurar DB | Servidor + Ops |
| Falha de push | N/A (sem feedback) | Reconnect; backfill | Cliente |

---

## Documentos relacionados

- [02 — Invariantes do Sistema](./02-system-invariants.md)
- [05 — Modelo de Mensagens](./05-messaging-model.md)
- [04 — Arquitetura](./04-architecture.md)
