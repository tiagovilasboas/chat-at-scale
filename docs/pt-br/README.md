# Documentação : Português (pt-BR)

Tradução para português brasileiro da documentação de design do sistema de mensagens em tempo real.

> **Nota:** Termos técnicos (WebSocket, fan-out, at-least-once, backfill, etc.) permanecem em inglês nas traduções.

---

## Documentos

| # | Documento | Descrição |
|---|-----------|-----------|
| 00 | [Regras Principais de Engenharia](./00-principal-engineering-rules.md) | Princípios gerais, gate de implementação e anti-padrões |
| 01 | [Definição do Problema](./01-problem-definition.md) | O que construímos, problemas resolvidos, premissas de escala |
| 02 | [Invariantes do Sistema](./02-system-invariants.md) | Propriedades que o sistema sempre deve manter |
| 03 | [Trade-offs](./03-trade-offs.md) | Decisões arquiteturais e justificativas |
| 04 | [Arquitetura](./04-architecture.md) | Componentes, responsabilidades e fluxo de dados |
| 05 | [Modelo de Mensagens](./05-messaging-model.md) | Entrega, ordenação, retries e tratamento offline |
| 06 | [Escalabilidade](./06-scalability.md) | Padrões de carga, gargalos e estratégias de escala |
| 07 | [Cenários de Falha](./07-failure-scenarios.md) | Modos de falha e recuperação |
| 08 | [Frontend como Sistema](./08-frontend-as-a-system.md) | O cliente como nó do sistema distribuído |
| 09 | [Observabilidade](./09-observability.md) | Logs, métricas e estratégias de debug |
| 10 | [Evolução](./10-evolution.md) | Evolução em produção, o que quebra primeiro |
| 11 | [Casos de Mensageria](./11-casos-mensageria.md) | Slack, Discord, WhatsApp com link do artigo |
| 12 | [Staff/Principal: o que é](./12-staff-principal-o-que-e.md) | O que diferencia Staff e Principal no mercado |
| — | [SLOs](./slos.md) | Metas de latência, disponibilidade, throughput |
| — | [Glossário](./glossario.md) | Termos técnicos (fan-out, backfill, cursor) |
| — | [ADRs](../adr/) | Decisões formais (WebSocket, at-least-once) |

---

## Ordem de leitura sugerida

1. **Começo:** [00 — Regras Principais](./00-principal-engineering-rules.md) → [01 — Definição do Problema](./01-problem-definition.md)
2. **Fundamentos:** [02 — Invariantes](./02-system-invariants.md) → [03 — Trade-offs](./03-trade-offs.md) → [04 — Arquitetura](./04-architecture.md)
3. **Contrato e escala:** [05 — Modelo de Mensagens](./05-messaging-model.md) → [06 — Escalabilidade](./06-scalability.md)
4. **Resiliência e operação:** [07 — Cenários de Falha](./07-failure-scenarios.md) → [08 — Frontend](./08-frontend-as-a-system.md) → [09 — Observabilidade](./09-observability.md)
5. **Visão de longo prazo:** [10 — Evolução](./10-evolution.md)
6. **Referência:** [11 — Casos](./11-casos-mensageria.md) · [12 — Staff/Principal](./12-staff-principal-o-que-e.md) · [SLOs](./slos.md) · [Glossário](./glossario.md) · [ADRs](../adr/)

---

Termos técnicos permanecem em inglês (WebSocket, fan-out, backfill, etc.).
