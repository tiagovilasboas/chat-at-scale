# Chat at Scale

Real-time messaging designed as a distributed system from day one: persist and mint `sequence` before fan-out, backfill on reconnect, no silent loss. MVP now; 10k–50k connections and 1k–2k msg/s without a rewrite.

Laboratório Staff de mensageria: chat não é CRUD com WebSocket grudado.

Maintainer: [Tiago Montanha](https://github.com/tiagovilasboas) · Staff · Distributed Systems · Observability

## Start

Two doors. Pick one.

**Run the MVP** (PostgreSQL + Fastify WebSocket gateway + React client):

```bash
docker compose up -d
npm install
cd apps/backend && npx drizzle-kit push && cd ../..
```

Two terminals from the repo root:

```bash
npm run dev --workspace=apps/backend
npm run dev --workspace=apps/web
```

Client: `http://localhost:5173`. Topology: [04 Architecture](./docs/pt-br/04-architecture.md). Stack rationale: [ADR 005](./docs/adr/005-initial-tech-stack-and-persistence.md).

**Read first** if you want the Staff trail (problem → invariants → code). Gate: do not add a capability until docs 01–10 are honest.

| Block | Time | Start here |
|---|---|---|
| Problem | ~10 min | [00 Rules](./docs/pt-br/00-principal-engineering-rules.md) · [01 Problem](./docs/pt-br/01-problem-definition.md) |
| Fundamentals | ~20 min | [02 Invariants](./docs/pt-br/02-system-invariants.md) · [03 Trade-offs](./docs/pt-br/03-trade-offs.md) · [04 Architecture](./docs/pt-br/04-architecture.md) |
| Contract and scale | ~20 min | [05 Messaging model](./docs/pt-br/05-messaging-model.md) · [06 Scalability](./docs/pt-br/06-scalability.md) |
| Resilience | ~30 min | [07 Failure](./docs/pt-br/07-failure-scenarios.md) · [08 Frontend as a node](./docs/pt-br/08-frontend-as-a-system.md) · [09 Observability](./docs/pt-br/09-observability.md) |
| Horizon | ~10 min | [10 Evolution](./docs/pt-br/10-evolution.md) |
| Reference | ~20 min | [Staff/Principal](./docs/pt-br/12-staff-principal-o-que-e.md) · [Messaging cases](./docs/pt-br/11-casos-mensageria.md) · [SLOs](./docs/pt-br/slos.md) · [Glossary](./docs/pt-br/glossario.md) · [ADRs](./docs/adr/) |

Trail 01–10 is about 1h30 at a technical pace (~200 wpm).

## Contents

- [Why this case](#why-this-case)
- [What we are building](#what-we-are-building)
- [Docs](#docs)
- [Cases](#cases)
- [Related](#related)
- [Agents](#agents)
- [Contributing](#contributing)
- [License](#license)

## Why this case

An interview asked *how would you scale XPTO?* I answered with a full design (docs, ADRs, public cases) instead of a whiteboard shrug. Chat is the case because it is one of the hardest complete systems you can pick: real-time, consistency, fan-out, reconnect, the frontend as a node, observability, evolution under load. Slack, Discord, and WhatsApp are the public proof.

Most “real-time chats” are CRUDs with a socket taped on. This one is not. At 10k–50k connections it is a distributed system, so the design starts there: delivery, ordering, retries, dedup, offline, recovery before the happy path.

The business ask is the usual one: scale with the product, do not drop messages, do not freeze on a spike, do not halt to rewrite when the base doubles.

## What we are building

| Capability | Target |
|---|---|
| **Real-time** | Sub-second delivery (P99 < 500ms at scale) |
| **Channels and groups** | Multi-participant conversations |
| **Delivery** | At-least-once; no silent loss |
| **Resilience** | Backfill on reconnect; tolerate partial failure |
| **Scale** | 10k–50k connections; 1k–2k msg/s |

Gateway (WebSocket), Messaging (persist, sequence, fan-out), Persistence, and the client as a system node. Details in [04 Architecture](./docs/pt-br/04-architecture.md).

Invariant that must not drift: every inbound message is persisted atomically to mint its `sequence` **before** WebSocket fan-out.

## Docs

Design docs are Portuguese first; technical terms stay in English. Index: [docs/pt-br](./docs/pt-br/). Decisions: [docs/adr](./docs/adr/).

| # | Doc |
|---|---|
| 00 | [Principal engineering rules](./docs/pt-br/00-principal-engineering-rules.md) |
| 01 | [Problem definition](./docs/pt-br/01-problem-definition.md) |
| 02 | [System invariants](./docs/pt-br/02-system-invariants.md) |
| 03 | [Trade-offs](./docs/pt-br/03-trade-offs.md) |
| 04 | [Architecture](./docs/pt-br/04-architecture.md) |
| 05 | [Messaging model](./docs/pt-br/05-messaging-model.md) |
| 06 | [Scalability](./docs/pt-br/06-scalability.md) |
| 07 | [Failure scenarios](./docs/pt-br/07-failure-scenarios.md) |
| 08 | [Frontend as a system](./docs/pt-br/08-frontend-as-a-system.md) |
| 09 | [Observability](./docs/pt-br/09-observability.md) |
| 10 | [Evolution](./docs/pt-br/10-evolution.md) |
| 11 | [Messaging cases](./docs/pt-br/11-casos-mensageria.md) |
| 12 | [What Staff/Principal means](./docs/pt-br/12-staff-principal-o-que-e.md) |
| - | [SLOs](./docs/pt-br/slos.md) · [Glossary](./docs/pt-br/glossario.md) · [ADRs](./docs/adr/) |

## Cases

Messaging: [Slack, Discord, WhatsApp](./docs/pt-br/11-casos-mensageria.md), each with a link to the original write-up.

Frontend: [19 cases](https://frontend-architecture-playbook-eight.vercel.app/guides/cases) (Netflix, Spotify, Shopify, eBay, and others).

Numbers and sources, not opinions. Useful in a review, an ADR, or a design meeting.

## Related

This repo is the older Staff lab: distributed messaging, invariants, and failure before the happy path. The agentic showcase is a sibling set, not a rewrite of this system.

- [awesome-agentic-ai](https://github.com/tiagovilasboas/awesome-agentic-ai) — curated MCP · harness · HITL
- [jarvis-architecture](https://github.com/tiagovilasboas/jarvis-architecture) — brain · workers · ops
- [agent-measurement](https://github.com/tiagovilasboas/agent-measurement) — measure agents, do not train
- [agentic-code-review](https://github.com/tiagovilasboas/agentic-code-review) — AppSec `path:line` or silence
- [Frontend Architecture Playbook](https://frontend-architecture-playbook-eight.vercel.app) — frontend as a system node

## Agents

[`CLAUDE.md`](./CLAUDE.md) holds the Staff/Principal invariants. Scoped personas live in [`.agents/personas/`](./.agents/personas/) (frontend, backend, QA, DBA). Load one persona at a time so a refactor does not leak across the blast radius.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). A feature is done only when the happy path *and* recovery work, trade-offs are written down, failure is named, and each invariant has a test or a check.

## License

[MIT](LICENSE)
