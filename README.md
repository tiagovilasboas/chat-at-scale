# Chat at Scale

> Dor real, solução real. O desafio de projetar mensageria em tempo real que escala de verdade.

---

## De onde veio isso

Esse projeto nasceu de uma pergunta de processo seletivo: *"Como você escalaria uma aplicação XPTO?"* Resolvi responder a sério usando chat como caso: em vez de só falar no abstract, montei um design completo com docs, ADRs e referências, e usei isso como portfolio de pensamento técnico.

**Por que chat?** Chat é um dos tipos de aplicação completa mais complexos que existem. Exige real-time, consistência, fan-out, reconexão, frontend como nó do sistema, observabilidade, evolução em escala. Não é CRUD com WebSocket grudado. Exercita tudo o que um Staff/Principal precisa saber: sistemas distribuídos, trade-offs, falhas, invariantes. Casos reais (Slack, Discord, WhatsApp) mostram que o problema é sério.

---

## O que rola aqui

A maioria dos chats em tempo real são CRUDs com WebSocket grudado. Esse aqui não: é pensado como **sistema distribuído** desde o início, porque em escala é isso que ele vira.

O problema? Construir uma plataforma de mensagens que vai de MVP até 10k–50k conexões e 1k–2k msg/s, sem ter que reescrever tudo no meio do caminho. Fan-out, backfill, at-least-once, reconexão, falhas de rede… tudo isso entra no design desde o dia um.

**Pra quem é:** Todo dev curioso de saber como eng de liderança técnica pensa e age. ([O que o mercado chama de Staff/Principal](./docs/pt-br/12-staff-principal-o-que-e.md))

**O que esperar:** Guia de referência, não material didático. Funciona bem pra quem já tem base em sistemas distribuídos e quer entender o mindset Staff/Principal. Junior, Pleno e Senior podem dar uma olhada como preview, mas quem mais aproveita é quem já está no nível de liderança técnica ou quer cair de cabeça nessa jornada: o primeiro usa como referência e benchmark; o segundo, como mapa do que virá e de como quem já está lá pensa.

---

## A demanda de negócio (o clássico)

*"Precisamos de um chat que escale com o negócio. Não podemos perder mensagens, travar em pico ou parar tudo pra refazer quando a base dobrar."*

---

## A trilha (por onde começar)

**Mindset Staff/Principal:** Nunca pule para implementação antes de entender o problema. Problema primeiro, invariantes, trade-offs, arquitetura, só então código. Essa regra permeia toda a documentação.

Se você quer entender como eng de liderança técnica pensa e age, segue essa ordem:

1. **Começo** (~10 min) - [00 Regras Principais](./docs/pt-br/00-principal-engineering-rules.md) e [01 Definição do Problema](./docs/pt-br/01-problem-definition.md)
2. **Fundamentos** (~20 min) - [02 Invariantes](./docs/pt-br/02-system-invariants.md), [03 Trade-offs](./docs/pt-br/03-trade-offs.md), [04 Arquitetura](./docs/pt-br/04-architecture.md)
3. **Contrato e escala** (~20 min) - [05 Modelo de Mensagens](./docs/pt-br/05-messaging-model.md) e [06 Escalabilidade](./docs/pt-br/06-scalability.md)
4. **Resiliência** (~30 min) - [07 Cenários de Falha](./docs/pt-br/07-failure-scenarios.md), [08 Frontend](./docs/pt-br/08-frontend-as-a-system.md), [09 Observabilidade](./docs/pt-br/09-observability.md)
5. **Visão de longo prazo** (~10 min) - [10 Evolução](./docs/pt-br/10-evolution.md)
6. **Referência** (~20 min) - [O que é Staff/Principal](./docs/pt-br/12-staff-principal-o-que-e.md), [Casos de Mensageria](./docs/pt-br/11-casos-mensageria.md), [SLOs](./docs/pt-br/slos.md), [Glossário](./docs/pt-br/glossario.md), [ADRs](./docs/adr/)

*Tempos estimados para leitura em ritmo técnico (~200 palavras/min). Trilha completa (01-10): ~1h30.*

O gate é simples: **não implemente até ter os docs 01-10 prontos**. Problema primeiro, código depois. Simples assim.

---

## O que estamos construindo

| Capacidade | Alvo |
|------------|------|
| **Real-time** | Entrega sub-segundo (P99 < 500ms em escala) |
| **Channels & groups** | Conversas com múltiplos participantes |
| **Delivery** | At-least-once; sem perda silenciosa |
| **Resiliência** | Backfill na reconexão; tolerância a falhas |
| **Escala** | 10k–50k conexões; 1k–2k msg/s |

Gateway (WebSocket), Messaging (persist, sequence, fan-out), Persistence e o cliente como nó do sistema. Detalhes em [04 Arquitetura](./docs/pt-br/04-architecture.md).

---

## Casos que todo eng de liderança técnica deveria conhecer

**Mensageria:** [Slack, Discord, WhatsApp](./docs/pt-br/11-casos-mensageria.md), cada um com link pro artigo original.

**Frontend:** [19 casos](https://frontend-architecture-playbook-eight.vercel.app/guides/cases), Netflix, Spotify, Shopify, eBay e outros.

Guarde pra usar em reunião, ADR ou proposta. Números e fontes reais.

---

## Documentação completa

[docs/pt-br](./docs/pt-br/). Tudo em português, termos técnicos em inglês.

| # | Doc |
|---|-----|
| 00 | [Regras Principais](./docs/pt-br/00-principal-engineering-rules.md) |
| 01 | [Definição do Problema](./docs/pt-br/01-problem-definition.md) |
| 02 | [Invariantes](./docs/pt-br/02-system-invariants.md) |
| 03 | [Trade-offs](./docs/pt-br/03-trade-offs.md) |
| 04 | [Arquitetura](./docs/pt-br/04-architecture.md) |
| 05 | [Modelo de Mensagens](./docs/pt-br/05-messaging-model.md) |
| 06 | [Escalabilidade](./docs/pt-br/06-scalability.md) |
| 07 | [Cenários de Falha](./docs/pt-br/07-failure-scenarios.md) |
| 08 | [Frontend como Sistema](./docs/pt-br/08-frontend-as-a-system.md) |
| 09 | [Observabilidade](./docs/pt-br/09-observability.md) |
| 10 | [Evolução](./docs/pt-br/10-evolution.md) |
| 11 | [Casos de Mensageria](./docs/pt-br/11-casos-mensageria.md) |
| 12 | [O que é Staff/Principal](./docs/pt-br/12-staff-principal-o-que-e.md) |
| - | [SLOs](./docs/pt-br/slos.md) · [Glossário](./docs/pt-br/glossario.md) · [ADRs](./docs/adr/) |

Contribuindo: [CONTRIBUTING.md](CONTRIBUTING.md) (gate, checklist de feature pronta).

---

## Executando

*Ainda não tem código. O repo tá em fase de design.*

Quando tiver: `docker compose up` ou `npm run dev` / `cargo run`. Topologia e fluxo em [04 Arquitetura](./docs/pt-br/04-architecture.md).

---

Feito com ❤️ por [**Tiago Vilas Boas**](https://github.com/tiagovilasboas) e uma galera de agentes co-pilotos. [MIT](LICENSE)
