# Chat at Scale

Laboratório Staff: projetar mensageria em tempo real como **sistema distribuído**, do problema até (opcionalmente) um MVP que roda. Docs e ADRs são o produto. Chat é o caso difícil, não CRUD com WebSocket grudado.

Maintainer: [Tiago Montanha](https://github.com/tiagovilasboas) · Staff · systems/observability

---

## De onde veio isso

Nasceu de uma pergunta de processo seletivo: *"Como você escalaria uma aplicação XPTO?"* Respondi com design completo (docs, ADRs, casos públicos) em vez de um shrug no whiteboard.

**Por que chat?** Real-time, consistência, fan-out, reconexão, frontend como nó, observabilidade, evolução em carga. Slack, Discord e WhatsApp são a prova pública. Quem mais aproveita é mid→Staff estudando como liderança técnica pensa: invariantes e trade-offs antes do código.

A demanda de negócio é a de sempre: escalar com o produto, não perder mensagem, não travar em pico, não parar tudo para reescrever quando a base dobrar.

---

## Começar

Duas portas. Escolha uma.

### Rodar o MVP

Nó único: PostgreSQL 16 + gateway Fastify (HTTP + WebSocket) + cliente React. Fan-out **in-memory**. Uma conversa global hardcoded. Serve para validar write-through, `sequence` e backfill, não para 10k conexões.

```bash
npm install
docker compose up -d --wait
npm run db:push
```

Dois terminais na raiz:

```bash
npm run dev:backend
npm run dev:web
```

Cliente: [http://localhost:5173](http://localhost:5173). Registre um usuário (senha ≥ 8), entre, mande mensagem. O Vite faz proxy de `/api` e `/ws` para `:8080` (cookie HttpOnly no upgrade). Copiar `.env.example` é opcional no lab local: o código tem fallback para Postgres e JWT. Sem Docker o `db:push` e o persist falham.

O que **não** está no processo que sobe: Event Bus, isolamento por membership, várias conversas, revogação da sessão no handshake WS. Isso está no design (docs 04, 06, 10 e [ADR 007](./docs/adr/007-persisted-gateway-authentication.md)).

### Ler o design primeiro

Gate: **não implemente capacidade nova até os docs 01–10 estarem honestos com o código**. Problema → invariantes → trade-offs → arquitetura → código.

| Bloco | Tempo | Comece aqui |
|---|---|---|
| Problema | ~10 min | [00 Regras](./docs/pt-br/00-principal-engineering-rules.md) · [01 Problema](./docs/pt-br/01-problem-definition.md) |
| Fundamentos | ~20 min | [02 Invariantes](./docs/pt-br/02-system-invariants.md) · [03 Trade-offs](./docs/pt-br/03-trade-offs.md) · [04 Arquitetura](./docs/pt-br/04-architecture.md) |
| Contrato e escala | ~20 min | [05 Modelo](./docs/pt-br/05-messaging-model.md) · [06 Escalabilidade](./docs/pt-br/06-scalability.md) |
| Resiliência | ~30 min | [07 Falhas](./docs/pt-br/07-failure-scenarios.md) · [08 Frontend como nó](./docs/pt-br/08-frontend-as-a-system.md) · [09 Observabilidade](./docs/pt-br/09-observability.md) |
| Horizonte | ~10 min | [10 Evolução](./docs/pt-br/10-evolution.md) |
| Referência | ~20 min | [Staff/Principal](./docs/pt-br/12-staff-principal-o-que-e.md) · [Casos](./docs/pt-br/11-casos-mensageria.md) · [SLOs](./docs/pt-br/slos.md) · [Glossário](./docs/pt-br/glossario.md) · [ADRs](./docs/adr/) |

Trilha 01–10: ~1h30 em ritmo técnico.

---

## Design vs o que o MVP faz

| Capacidade (alvo de design) | No processo que roda hoje |
|---|---|
| Entrega sub-segundo | Happy path local, sem SLO medido |
| Canais e grupos | Uma `conversationId` fixa; tabela `conversation_members` existe e **não** é consultada |
| At-least-once, sem perda silenciosa | Persistência write-through **antes** do fan-out; `sequence` via `MAX+1` (suficiente em nó único, corrida sob writers concorrentes) |
| Backfill na reconexão | `sync` com cursor de `sequence` no `onopen` |
| 10k–50k conexões; 1k–2k msg/s | Fan-out `websocketServer.clients` no processo. Event Bus é evolução (doc 10), não o código |

Invariante que o código tenta respeitar: persistir e mintar `sequence` **antes** do fan-out. INV-002 (isolamento por membership) o design exige; o MVP ainda não.

Detalhe de sessão (cookie HttpOnly, JWT verify-only no WS, `revoked_at` ainda não lido no handshake): [ADR 007](./docs/adr/007-persisted-gateway-authentication.md). Este lab não é um kit de AppSec.

---

## Documentação

Português primeiro; termos técnicos em inglês. Índice: [docs/pt-br](./docs/pt-br/). Decisões: [docs/adr](./docs/adr/).

| # | Doc |
|---|---|
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

**Casos:** [Slack, Discord, WhatsApp](./docs/pt-br/11-casos-mensageria.md), cada um com o artigo original. Frontend como nó: [19 casos](https://frontend-architecture-playbook-eight.vercel.app/guides/cases). Números e fontes, não opinião.

---

## Agents

[`AGENTS.md`](./AGENTS.md) é o contrato para IA neste repo. [`CLAUDE.md`](./CLAUDE.md) guarda invariantes Staff. Personas em [`.agents/personas/`](./.agents/personas/) são blast radius (frontend / backend / DBA / QA), não um produto multi-agent.

---

## Contribuindo

[CONTRIBUTING.md](CONTRIBUTING.md). Feature pronta só com happy path **e** recuperação, trade-off escrito, falha nomeada, invariante com teste ou verificação.

Checks locais (os mesmos do CI):

```bash
npm run ci
```

---

[MIT](LICENSE) · [Tiago Vilas Boas](https://github.com/tiagovilasboas)
