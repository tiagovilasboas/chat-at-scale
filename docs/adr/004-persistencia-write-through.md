# ADR-004: Persistência write-through

## Status

Aceito

## Data

2025-03-23

## Contexto

Mensagens devem ser persistidas antes de ack ao remetente para evitar perda silenciosa (INV-004, INV-007). A escolha entre write-through e write-behind impacta latência e garantias.

## Decisão

Write-through: persistir no banco antes de enviar ack ao remetente. Ack implica persistência.

## Alternativas consideradas

### Write-through
- Prós: sem perda em crash; ack = persistido; simples
- Contras: latência de escrita no caminho crítico

### Write-behind (async)
- Prós: menor latência; buffer em memória
- Contras: risco de perda em crash antes de flush; complexidade

## Consequências

### Positivas
- INV-007 respeitado: ack implica persistência
- Sem perda silenciosa em falha do processo
- Custo de latência aceitável para correção (doc 03)

### Negativas
- Latência de envio inclui round-trip ao banco
- Em escala, pode exigir otimizações (batch, conexões)

### Riscos
- Em picos de escrita, banco pode ser gargalo; ver doc 06 (Escalabilidade)

## Referências

- [03 — Trade-offs](../pt-br/03-trade-offs.md)
- [02 — Invariantes (INV-007)](../pt-br/02-system-invariants.md)
- [04 — Arquitetura](../pt-br/04-architecture.md)
