# SLOs: Service Level Objectives

> Metas explícitas de desempenho e disponibilidade. Toda decisão arquitetural deve considerar esses objetivos.

---

## 1. Latência

| Métrica | Meta MVP | Meta produção | Medição |
|---------|----------|---------------|---------|
| **Entrega de mensagem (P50)** | < 500ms | < 200ms | Tempo desde envio até ack + push ao destinatário |
| **Entrega de mensagem (P99)** | < 1s | < 500ms | Idem |
| **Backfill (primeiro chunk)** | < 2s | < 1s | Tempo desde reconnect até primeira mensagem retornada |
| **Heartbeat / conectividade** | 30s | 30s | Intervalo máximo entre pings |

---

## 2. Disponibilidade

| Métrica | Meta MVP | Meta produção | Medição |
|---------|----------|---------------|---------|
| **Uptime do sistema** | Best effort | 99,9% | Tempo em que clientes conseguem conectar e trocar mensagens |
| **Taxa de erro de envio** | < 1% | < 0,1% | Mensagens que falham após retries |
| **Janela de reconexão** | - | < 5s | Tempo típico para cliente reconectar e receber backfill |

---

## 3. Throughput

| Métrica | Meta MVP | Meta produção | Medição |
|---------|----------|---------------|---------|
| **Conexões simultâneas** | 100–500 | 10k–50k | Número de WebSockets ativos |
| **Mensagens/segundo (pico)** | < 100 | 500–2k | Taxa sustentável de envio + fan-out |
| **Mensagens/dia** | 10k–50k | 1M–10M | Volume diário persistido |

---

## 4. Recuperação

| Métrica | Meta | Descrição |
|---------|------|-----------|
| **RTO (Recovery Time Objective)** | < 5min | Tempo máximo aceitável para restaurar serviço após falha |
| **RPO (Recovery Point Objective)** | 0 | Nenhuma mensagem perdida após persistência write-through |

---

## 5. Consistência

| Garantia | Valor |
|----------|-------|
| **Entrega** | At-least-once |
| **Ordem** | Total por conversa |
| **Deduplicação** | Cliente por message_id |

---

## Como usar

1. **Design:** Toda decisão em docs 03–10 deve ser compatível com esses SLOs.
2. **Implementação:** Instrumentar métricas antes de otimizar.
3. **Operação:** Alertas quando SLOs forem violados; runbooks para recuperação.
4. **Revisão:** Atualizar SLOs quando premissas de escala mudarem.

---

## Referências

- [01 - Definição do Problema (premissas de escala)](./01-problem-definition.md)
- [06 - Escalabilidade](./06-scalability.md)
- [09 - Observabilidade](./09-observability.md)
