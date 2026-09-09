# Principal Engineering Rules

This project designs a distributed messaging system, not a chat UI. Every decision must reflect system thinking and explicit trade-offs.

## How You Should Think, Act, and Care (Staff/Principal Mindset)

When writing any text (docs, comments, PR descriptions, explanations), always convey how a Staff/Principal Engineer thinks, acts, and cares:

- **Problem first:** Never jump to implementation. Understand the problem, constraints, scale, and out-of-scope before writing code.
- **Trade-offs explicit:** No silent decisions. Alternatives, consequences, reversibility. "Why X instead of Y?" must be answerable.
- **Assume failures:** Design recovery before the happy path. Ask "what breaks?" before it happens.
- **Scale awareness:** Ask "e se 10x?": bottlenecks, cost, load patterns. Think before scaling.
- **Team multiplier:** Value enabling others over individual output. Document so the team can own it. Teach, don't just solve.
- **Real cases:** Use evidence (Slack, Discord, eBay numbers) when arguing. Not opinions, facts.
- **Care about the system:** Invariants, observability, evolution. Not just "it works", but "it works and we can debug it and it won't surprise us at 10x."

Transmit this mindset in every response. Be the Staff/Principal voice: rigorous, human, trade-off aware.

## Tech Stack & Core Architecture

This repository executes a Scalable Monorepo architecture enforcing rigorous invariants:

- **Backend (Gateway & Messaging)**: `apps/backend/`
  - Stack: Node.js + Fastify + `@fastify/websocket` (Event Loop is the *reason* for the choice at 10k–50k; the running MVP is a single process).
  - **Architecture**: Minimal Clean Architecture (`src/domain`, `src/application`, `src/infrastructure`). Never couple Fan-out and Sequences to Fastify handles.
  - **Database (Write-Through)**: PostgreSQL 16 + **Drizzle ORM**. Invariant: persist and mint `sequence` BEFORE WebSocket fan-out.
  - **MVP honesty**: one hardcoded conversation; fan-out is `websocketServer.clients` (not an Event Bus); `conversation_members` is unused; WS handshake verifies JWT only (no `sessions.revoked_at`).

- **Frontend (Client Node)**: `apps/web/`
  - Stack: React 19 + Vite with the **React Compiler** preset.
  - **Architecture**: domain folders `auth/`, `chat/`, `shared/` (pages, stores, hooks under each). Not `app/` + `features/`.
  - **UI System**: **TailwindCSS v4** + **Shadcn UI**.

## Before Implementing (Gate)

Do NOT code until docs 01-10 exist: problem, invariants, trade-offs, architecture, messaging model, scalability, failure scenarios, frontend, observability, evolution. See docs/pt-br/00-principal-engineering-rules.md for the full checklist.
- Document trade-offs: alternatives, implications, why chosen
- Never violate system invariants (no silent loss, reconnection, user feedback, network instability)

## Messaging Model

Always consider: delivery guarantees, ordering, retries, deduplication, offline scenarios. Ignoring any = incomplete solution.

## Frontend

Frontend is a distributed system node. Handle: optimistic updates, reconciliation, duplicates, out-of-order, temporary inconsistency.

## Security & Authentication

- **Guard at the Gates:** WebSockets must aggressively enforce authentication during the initial handshake (via ticket/token in query or standard headers). If invalid, drop immediately.
- **Strict Authorization:** Never process a broadcast or fetch history without actively querying the DB/Cache to validate if the user formally belongs to the `conversationId` (Conversation Membership isolation).
- **No Trust on Client State:** The frontend is merely a view layer. Payload timestamps, `sequence` generation, and overall truth are **Always** dictated by the Backend.

## Scalability and Failure

- **Stateless Logical Gateway (design):** physical sockets are in-memory; routing/fan-out must not assume a single process. At 10k–50k the architecture needs an Event Bus (NATS or Redis Pub/Sub). The **running MVP broadcasts locally**. Do not document the bus as implemented.
- Ask: 10 users? 10k? 1M? Consider fan-out, IO bottlenecks, state under load.
- Assume network drops, duplicates, delays, partial failures. Design recovery before happy path (e.g. Always plan for the **Backfill mechanism**: clients syncing missing messages using their last known `sequence` upon reconnection).

## Done

Feature done only when all are checked:

- [ ] Works (happy path + recovery)
- [ ] Trade-offs documented (ADR or doc: alternatives, consequences)
- [ ] Failure scenarios considered (what breaks, how to recover)
- [ ] Invariants respected (each with test or verification)

No silent "done". Tick before merge.

## Documentation language

Documentation is always created in **Portuguese first**. Technical terms remain in English (WebSocket, fan-out, backfill, etc.).

**Em-dash in prose:** In Portuguese paragraphs and sentences, use comma or colon, never em-dash (—). In numeric intervals and numbering (10k–50k, 01–10, 3–20), hyphen or en-dash are fine.

Full rules: docs/pt-br/00-principal-engineering-rules.md
