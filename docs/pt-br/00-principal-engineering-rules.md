# 00 — Regras Principais de Engenharia

> Este projeto não é sobre criar uma UI de chat. É sobre projetar um sistema de mensagens distribuído que evolui do MVP até escala. Cada decisão deve refletir pensamento sistêmico, trade-offs explícitos, consciência de escalabilidade e tratamento de falhas.

**Como atuar como Staff/Principal:** Você jamais pula para implementação antes de entender o problema. Problema primeiro, invariantes depois, trade-offs explícitos, arquitetura, só então código. Essa regra vale em todo projeto, não só neste.

---

## Princípios Gerais

- NÃO pule para implementação antes de definir o problema
- Sempre torne os trade-offs explícitos
- Prefira clareza a astúcia
- Evite overengineering, mas NUNCA ignore implicações de escala
- Código é consequência de decisões, não o ponto de partida

---

## Antes da Implementação (Gate)

Não implemente até que todos os itens abaixo existam e estejam documentados:

| # | Pré-requisito | Doc | Status |
|---|---------------|-----|--------|
| 1 | Problema definido (o quê, restrições, escala, fora do escopo) | [01](./01-problem-definition.md) | ✓ |
| 2 | Invariantes do sistema (o que jamais pode quebrar) | [02](./02-system-invariants.md) | ✓ |
| 3 | Trade-offs (alternativas, decisões, justificativa) | [03](./03-trade-offs.md) | ✓ |
| 4 | Arquitetura (componentes, fluxo de dados, implantação) | [04](./04-architecture.md) | ✓ |
| 5 | Modelo de mensagens (entrega, ordenação, retry, dedup, offline) | [05](./05-messaging-model.md) | ✓ |
| 6 | Escalabilidade (tipos de carga, gargalos, estratégias de escala) | [06](./06-scalability.md) | ✓ |
| 7 | Cenários de falha (recuperação para cada modo de falha) | [07](./07-failure-scenarios.md) | ✓ |
| 8 | Responsabilidades do frontend (otimista, reconciliação, dedup) | [08](./08-frontend-as-a-system.md) | ✓ |
| 9 | Observabilidade (logs, métricas, debug) | [09](./09-observability.md) | ✓ |
| 10 | Evolução (o que muda, quebra, precisa redesenho em escala) | [10](./10-evolution.md) | ✓ |

**Se qualquer linha estiver ausente ou incompleta: PARE. Defina primeiro.**

---

## Problema Primeiro

Antes de implementar qualquer coisa, pergunte sempre:

- Que problema estamos resolvendo?
- Quais são as restrições?
- Quais são as premissas de escala?
- O que estamos explicitamente NÃO resolvendo?

Se isto não estiver claro, **PARE** e defina.

---

## Invariantes do Sistema

Toda funcionalidade deve respeitar os invariantes do sistema:

- Mensagens não podem desaparecer silenciosamente
- O sistema deve lidar com reconexão
- O usuário deve sempre ter feedback (enviando, enviado, falhou)
- O sistema deve tolerar instabilidade de rede

**Nunca implemente nada que viole isso.** Veja [02 — Invariantes do Sistema](./02-system-invariants.md).

---

## Trade-offs São Obrigatórios

Toda decisão técnica deve incluir:

- Alternativas consideradas
- Trade-offs
- Por que a abordagem escolhida se encaixa no contexto

Exemplos: WebSocket vs polling; at-least-once vs at-most-once; consistência forte vs eventual.

**Sem decisões silenciosas.** Veja [03 — Trade-offs](./03-trade-offs.md).

---

## Consciência do Modelo de Mensagens

Isto é um sistema de mensagens. Sempre considere:

- garantias de entrega
- ordenação
- retries
- deduplicação
- cenários offline

**Se sua solução ignora algum desses, está incompleta.** Veja [05 — Modelo de Mensagens](./05-messaging-model.md).

---

## Frontend como Nó de Sistema Distribuído

O frontend NÃO é só UI. Ele deve lidar com:

- atualizações otimistas
- reconciliação com estado do servidor
- mensagens duplicadas
- mensagens fora de ordem
- inconsistência temporária

Projete de acordo. Veja [08 — Frontend como Sistema](./08-frontend-as-a-system.md).

---

## Comunicação em Tempo Real

- Prefira WebSocket para comunicação em tempo real
- Projete para reconexão e fallback
- Nunca assuma conexão estável

---

## Pensamento em Escalabilidade

Sempre pergunte:

- O que acontece com 10 usuários?
- O que acontece com 10.000 usuários?
- O que acontece com 1 milhão de usuários?

Considere: fan-out, gargalos, gerenciamento de estado sob carga. Veja [06 — Escalabilidade](./06-scalability.md).

---

## Mentalidade de Falha Primeiro

Assuma que as coisas vão falhar:

- quedas de rede
- mensagens duplicadas
- entrega atrasada
- falha parcial do sistema

**Projete estratégias de recuperação antes do happy path.** Veja [07 — Cenários de Falha](./07-failure-scenarios.md).

---

## Fronteiras do Sistema

Respeite responsabilidades claras:

- **Cliente:** UX e estado local
- **Sistema de mensagens:** garantias de entrega
- **Backend:** persistência e distribuição

Não misture responsabilidades sem justificativa. Veja [04 — Arquitetura](./04-architecture.md).

---

## Observabilidade

O código deve ser depurável. Inclua:

- logs para ações-chave
- visibilidade do ciclo de vida das mensagens
- capacidade de rastrear falhas

Veja [09 — Observabilidade](./09-observability.md).

---

## Documentação Primeiro

Todas as decisões importantes devem ser documentadas em `/docs`.

**Se uma decisão não está documentada, ela não existe.**

**Idioma:** Documentação sempre em português primeiro. Termos técnicos permanecem em inglês (WebSocket, fan-out, backfill, etc.).

**Referências:** [Staff/Principal: o que é](./12-staff-principal-o-que-e.md), [ADRs](../adr/), [SLOs](./slos.md), [Glossário](./glossario.md), [Casos](./11-casos-mensageria.md).

---

## Anti-Padrões

Evite:

- decisões puramente voltadas a UI
- ignorar cenários de falha
- assumir condições de rede perfeitas
- comportamento implícito sem documentação
- micro-otimizações prematuras sem contexto

---

## Definição de Pronto

Uma funcionalidade só está pronta quando:

- funciona
- trade-offs estão documentados
- cenários de falha foram considerados
- respeita invariantes do sistema

**Quando implementar:** Use invariantes como critérios de aceite explícitos. Cada invariante deve ter pelo menos um teste ou verificação que valide respeito. Sem isso, "respeita invariantes" vira afirmação vazia.

---

## Regra Final

**Isso não é sobre escrever código.** É sobre pensar como um engenheiro responsável por sistemas em escala.
