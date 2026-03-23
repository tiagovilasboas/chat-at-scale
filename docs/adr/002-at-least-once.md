# ADR-002: Garantia de entrega at-least-once

## Status

Aceito

## Data

2025-03-23

## Contexto

Chat exige que mensagens não sejam perdidas silenciosamente (INV-004). Precisamos definir a semântica de entrega: at-most-once, at-least-once ou exactly-once.

## Decisão

At-least-once como garantia de entrega. Cliente deduplica por message_id (INV-003).

## Alternativas consideradas

### At-most-once
- Prós: mais simples, menor latência
- Contras: mensagens podem ser perdidas; inaceitável para chat

### At-least-once
- Prós: sem perda silenciosa; mais simples que exactly-once
- Contras: duplicatas possíveis; cliente deve deduplicar

### Exactly-once
- Prós: semântica limpa, sem duplicatas
- Contras: dedup store, idempotência, coordenação; complexo

## Consequências

### Positivas
- INV-004 e INV-005 respeitados
- Implementação mais simples que exactly-once
- Dedup no cliente com message IDs imutáveis é bem entendido
- Não bloqueia evolução futura para exactly-once

### Negativas
- Cliente pode exibir duplicatas momentaneamente; dedup resolve

### Riscos
- Nenhum crítico. Exactly-once pode ser adicionado depois com dedup server-side.

## Referências

- [03 - Trade-offs](../pt-br/03-trade-offs.md)
- [05 - Modelo de Mensagens](../pt-br/05-messaging-model.md)
- [02 - Invariantes (INV-003, INV-004, INV-005)](../pt-br/02-system-invariants.md)
