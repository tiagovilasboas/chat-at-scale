# 09 - Observabilidade

> Logs, métricas e estratégias de debug para operações e resposta a incidentes.

**Staff/Principal:** Observabilidade entra no design, não depois do deploy. Se você não sabe como debugar em produção antes de codificar, está adiando o inevitável.

---

## 1. Logs

### 1.1 Princípios

- **Estruturados:** JSON ou key-value; parseáveis por agregadores de log.
- **Correlação:** Todo log relacionado a mensagem ou requisição inclui `trace_id` e `message_id` (ou `request_id`) para tracing ponta a ponta.
- **Dados sensíveis:** Sem conteúdo de mensagem nos logs (privacidade). Log message_id, conversation_id, user_id; não content.
- **Níveis de log:** `ERROR` para falhas; `WARN` para retries, backpressure; `INFO` para eventos de ciclo de vida; `DEBUG` para detalhe por mensagem (desabilitar em prod).

### 1.2 O que logar, por componente

#### Gateway

| Evento | Nível | Campos |
|--------|-------|--------|
| Cliente conecta | INFO | `trace_id`, `user_id`, `connection_id`, `gateway_instance` |
| Cliente desconecta | INFO | `trace_id`, `user_id`, `connection_id`, `reason` (close, timeout, error) |
| Falha de auth | WARN | `trace_id`, `user_id`, `reason` |
| Mensagem recebida (send) | DEBUG | `trace_id`, `idempotency_key`, `conversation_id`, `user_id` |
| Mensagem empurrada | DEBUG | `trace_id`, `message_id`, `recipient_user_id`, `success` |
| Push falhou | WARN | `trace_id`, `message_id`, `recipient_user_id`, `error` |
| Timeout de heartbeat | INFO | `trace_id`, `user_id`, `connection_id` |
| Requisição de backfill | DEBUG | `trace_id`, `user_id`, `conversation_id`, `after_sequence`, `limit` |

#### Messaging

| Evento | Nível | Campos |
|--------|-------|--------|
| Mensagem recebida | INFO | `trace_id`, `idempotency_key`, `conversation_id`, `sender_id` |
| Validação falhou | WARN | `trace_id`, `idempotency_key`, `reason` (not_member, invalid_format) |
| Persist iniciado | DEBUG | `trace_id`, `message_id`, `conversation_id`, `sequence` |
| Persist sucesso | INFO | `trace_id`, `message_id`, `conversation_id`, `sequence` |
| Persist falhou | ERROR | `trace_id`, `idempotency_key`, `error` |
| Retry de persist | WARN | `trace_id`, `message_id`, `attempt`, `error` |
| Fan-out iniciado | DEBUG | `trace_id`, `message_id`, `recipient_count` |
| Fan-out completado | INFO | `trace_id`, `message_id`, `pushed_count`, `offline_count` |
| Idempotency hit | INFO | `trace_id`, `idempotency_key`, `message_id`, `sequence` |

#### Persistência

| Evento | Nível | Campos |
|--------|-------|--------|
| Escrita de mensagem | DEBUG | `trace_id`, `message_id`, `conversation_id`, `sequence` |
| Escrita falhou | ERROR | `trace_id`, `operation`, `error` |
| Query de backfill | DEBUG | `trace_id`, `conversation_id`, `after_sequence`, `limit`, `result_count` |
| Backfill lento | WARN | `trace_id`, `conversation_id`, `duration_ms` |

### 1.3 Exemplo de formato de log

```json
{
  "timestamp": "2025-03-23T10:00:00.123Z",
  "level": "INFO",
  "component": "messaging",
  "trace_id": "abc123",
  "message_id": "msg_xyz",
  "conversation_id": "conv_1",
  "event": "persist_succeeded",
  "sequence": 42
}
```

### 1.4 Correlação: propagação de trace_id

- Cliente envia `trace_id` (ou `request_id`) com cada envio. Gerar UUID por envio.
- Gateway encaminha trace_id ao Messaging.
- Messaging usa para persist, fan-out. Gateway usa para push.
- Todos logs dessa mensagem compartilham o mesmo trace_id. Permite "seguir esta mensagem" nos logs.

---

## 2. Métricas

### 2.1 Latência

| Métrica | Descrição | Labels | SLO (grande escala) |
|---------|-----------|--------|---------------------|
| `send_to_ack_seconds` | Tempo do envio do cliente ao ack | `conversation_id` (opcional) | P99 < 500ms |
| `send_to_receive_seconds` | Tempo do envio até destinatário receber push | `conversation_id` (opcional) | P99 < 500ms |
| `backfill_duration_seconds` | Tempo para requisição de backfill completar | `conversation_id` (opcional) | P99 < 2s |
| `persist_duration_seconds` | Latência de escrita no DB | | P99 < 100ms |
| `fan_out_duration_seconds` | Tempo para completar fan-out | `recipient_count` (bucket) | P99 < 200ms |
| `gateway_push_duration_seconds` | Tempo para empurrar a um cliente | | P99 < 50ms |

**Implementação:** Histograma. Registrar duração em cada estágio. Exportar percentis (p50, p95, p99).

### 2.2 Throughput

| Métrica | Descrição | Labels |
|---------|-----------|--------|
| `messages_received_total` | Mensagens recebidas dos clientes | `gateway_instance` |
| `messages_persisted_total` | Mensagens persistidas com sucesso | |
| `messages_pushed_total` | Eventos de push enviados aos destinatários | `gateway_instance` |
| `backfill_requests_total` | Requisições de backfill | `gateway_instance` |
| `connections_active` | Conexões WebSocket atuais | `gateway_instance` |
| `messages_per_second` | Taxa de mensagens (counter ou gauge) | |

### 2.3 Falhas

| Métrica | Descrição | Labels |
|---------|-----------|--------|
| `send_failures_total` | Envio rejeitado ou erro retornado | `reason` (validation, persist, timeout) |
| `persist_failures_total` | Escrita no DB falhou | `error_type` |
| `push_failures_total` | Push ao cliente falhou | `gateway_instance`, `reason` |
| `connection_failures_total` | Auth falhou, conexão rejeitada | `reason` |
| `backfill_failures_total` | Requisição de backfill falhou | `reason` |
| `heartbeat_timeouts_total` | Conexões fechadas por timeout | `gateway_instance` |

### 2.4 Retries

| Métrica | Descrição | Labels |
|---------|-----------|--------|
| `sender_retries_total` | Cliente retentou envio (inferido de idempotency hits) | |
| `idempotency_hits_total` | Servidor retornou ack em cache (envio duplicado) | |
| `persist_retries_total` | Servidor retentou escrita no DB | `attempt` |
| `persist_retry_exhausted_total` | Desistiu após max retries | |

### 2.5 Saúde do sistema

| Métrica | Descrição |
|---------|-----------|
| `gateway_connections` | Gauge; conexões atuais por instância |
| `messaging_queue_depth` | Se assíncrono; mensagens aguardando |
| `persistence_connection_pool_usage` | Saturação do pool do DB |
| `process_cpu_seconds` | Para planejamento de capacidade |
| `process_resident_memory_bytes` | Para planejamento de capacidade |

### 2.6 Limiares de alerta

| Alerta | Condição | Severidade |
|--------|----------|------------|
| Latência alta de envio | P99 send_to_ack > 1s por 5m | Warning |
| Latência alta de envio | P99 send_to_ack > 2s por 5m | Critical |
| Taxa de falha de persist | persist_failures / messages_received > 1% por 5m | Critical |
| Taxa de falha de push | push_failures / messages_pushed > 5% por 5m | Warning |
| Queda de conexões | connections_active cai > 20% em 5m | Warning |
| Falhas de backfill | backfill_failures_total > 10 em 5m | Warning |
| Verificação de invariante | acked_not_delivered > 0 (INV-004) | Critical |

---

## 3. Estratégias de debug

### 3.1 Traçar mensagem ponta a ponta

**Objetivo:** "Usuário A enviou mensagem M; o usuário B recebeu?"

1. **Obter identificadores:** `message_id`, `conversation_id`, `trace_id` (se cliente enviou), timestamps.
2. **Buscar logs** por `message_id` ou `trace_id`:
   - Messaging: `persist_succeeded` → mensagem foi armazenada.
   - Messaging: `fan_out_completed` com `pushed_count` → quantos receberam push.
   - Gateway: `message_pushed` com `recipient_user_id=B` → Gateway do B recebeu?
   - Gateway: `push_failed` para usuário B → push falhou; B receberá via backfill.
3. **Se B alega nunca ter recebido:** Verificar logs de backfill do usuário B, conversa, `after_sequence` cobrindo sequence de M. Se backfill retornou, cliente deveria ter (bug no cliente?). Se não, verificar membership: B estava na conversa no momento do envio?

**Propagação de trace_id:** Se cliente envia trace_id, um grep encontra o caminho completo.

### 3.2 Debug "mensagem não recebida"

| Hipótese | Verificar |
|----------|-----------|
| Mensagem nunca persistida | Logs: `persist_succeeded` para message_id? Se não, `persist_failed`? |
| Usuário não no membership | Tabela/cache de membership; momento do join vs momento da mensagem |
| Usuário offline no envio | Esperado; backfill ao conectar. Verificar logs de backfill para este usuário. |
| Push falhou | Logs do Gateway: `push_failed` para este usuário? |
| Conversa errada | Logs: conversation_id no fan-out combina com assinatura do usuário? |
| Cliente nunca solicitou backfill | Logs de backfill: alguma requisição deste usuário para esta conversa após momento do envio? |
| Cursor além da mensagem | Cliente enviou `after_sequence > message.sequence`; backfill pulou. Bug: cursor muito agressivo. |

### 3.3 Debug de latência

| Sintoma | Investigação |
|---------|-------------|
| Ack lento | `send_to_ack` alto. Detalhar: `persist_duration` (DB lento?), `fan_out_duration` (muitos destinatários?). Verificar métricas da Persistência; slow query log do DB. |
| Recebimento lento | `send_to_receive` alto. Caminho do push: Messaging → Gateway → cliente. Verificar `gateway_push_duration`; Gateway sobrecarregado? |
| Backfill lento | `backfill_duration` alto. Query do DB lenta? Índice em (conversation_id, sequence)? Lag da read replica? |
| Picos intermitentes | Correlacionar com carga (messages_per_second, connections). Possíveis pausas de GC; verificar métricas do processo. |

### 3.4 Debug de retries e falhas

| Sintoma | Investigação |
|---------|-------------|
| Alto idempotency hits | Clientes retentando agressivamente. Verificar `sender_retries_total`; rede instável? Restarts do Gateway? |
| Retries de persist | DB sobrecarregado ou instável. Verificar persist_failures, persist_retries, métricas do DB. |
| Falhas de push | Destinatários desconectando antes do push? Verificar churn de conexões. Ou Gateway sobrecarregado? |
| Falhas de auth | Token expirado? Bug de validação? Verificar `connection_failures` por reason. |

### 3.5 Validação de invariantes (INV-004, INV-005)

**Acked vs delivered:** Job periódico ou query:

- Para cada mensagem acked, garantir que aparece em backfill para cada participante (ou foi empurrada).
- Métrica: `messages_acked_total` vs `messages_delivered_total` por (mensagem, participante). Alerta em divergência.
- Baseado em logs: amostrar acks; rastrear até push/backfill delivery. Teste automatizado em staging.

### 3.6 Checklist de debug

| Passo | Ação |
|-------|------|
| 1 | Obter message_id, conversation_id, user_ids, período |
| 2 | Buscar logs por message_id (ou trace_id) para caminho completo |
| 3 | Verificar persist_succeeded |
| 4 | Verificar que fan_out incluiu destinatários pretendidos |
| 5 | Verificar sucesso de push ou backfill para offline |
| 6 | Verificar membership no momento do envio |
| 7 | Verificar client-side: cursor, requisição de backfill, dedup |

---

## 4. MVP vs escala

| Aspecto | MVP | Escala |
|---------|-----|--------|
| Agregação de logs | stdout; grep ou ELK básico | Centralizada (Loki, ELK, CloudWatch) |
| Métricas | Prometheus ou similar | Mesmo + dashboards Grafana |
| Tracing | trace_id nos logs; correlação manual | OpenTelemetry; Jaeger/Tempo |
| Alertas | Manual | PagerDuty/Opsgenie; baseado em SLO |
| Sampling | Logar tudo | Samplear DEBUG; ERROR/WARN completo |

---

## 5. Sugestões de dashboard

### 5.1 Dashboard de operações

- Conexões ao longo do tempo (por Gateway)
- Mensagens/s (send, persist, push)
- Percentis de latência: send_to_ack, send_to_receive, backfill
- Taxas de erro: persist, push, auth
- Taxas de retry: idempotency hits, persist retries

### 5.2 Dashboard de debug

- Busca por message_id (logs)
- Busca por trace_id (logs)
- Por user_id: conexões, requisições de backfill, sucesso de push
- Por conversation_id: taxa de mensagens, tamanho do fan-out

---

## Documentos relacionados

- [02 - Invariantes do Sistema](./02-system-invariants.md) (auditoria INV-004)
- [04 - Arquitetura](./04-architecture.md)
- [07 - Cenários de Falha](./07-failure-scenarios.md)
