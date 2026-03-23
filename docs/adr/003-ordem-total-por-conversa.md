# ADR-003: Ordem total por conversa

## Status

Aceito

## Data

2025-03-23

## Contexto

Threads de chat e replies exigem ordem consistente entre participantes. INV-008 exige que todo participante observe a mesma ordem total em uma conversa.

## Decisão

Ordem total por conversa. Servidor atribui número de sequence monotônico por conversa. Um escritor (ou shard por conversa) garante ordem única.

## Alternativas consideradas

### Ordem eventual
- Prós: mais simples, alta disponibilidade
- Contras: ordem pode diferir; quebra threading e UX

### Ordem causal
- Prós: preserva happened-before
- Contras: participantes podem ver ordens totais diferentes; replies quebram

### Ordem total por conversa
- Prós: UX clara; replies sempre fazem sentido; alinhado com INV-008
- Contras: coordenação (single sequencer); aceitável por conversa

### Ordem por remetente
- Prós: coordenação mais fraca
- Contras: ambíguo em grupo de chat

## Consequências

### Positivas
- Todos veem mesma sequência; replies e threads consistentes
- Implementação: sequence monotônico; single sequencer por conversa
- Conversas independentes; escala adicionando conversas

### Negativas
- Requer coordenação por conversa
- Single sequencer pode ser gargalo; mitigável com shard por conversa

### Riscos
- Nenhum crítico. Modelo bem estabelecido em sistemas de chat.

## Referências

- [03 - Trade-offs](../pt-br/03-trade-offs.md)
- [05 - Modelo de Mensagens](../pt-br/05-messaging-model.md)
- [02 - Invariantes (INV-008)](../pt-br/02-system-invariants.md)
