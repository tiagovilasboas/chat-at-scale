# Agent notes

This repo is a Staff/Principal **portfolio lab**: design a real-time messaging system (problem → invariants → trade-offs → architecture → optional running MVP). Docs and ADRs are the product. Chat is the hard case.

Not an Agentic AI showcase. Not an AppSec kit. Audience: mid→Staff engineers studying how leadership eng thinks.

Humans: [CONTRIBUTING.md](CONTRIBUTING.md). Mindset: [docs/pt-br/00-principal-engineering-rules.md](docs/pt-br/00-principal-engineering-rules.md). Invariants for code: [CLAUDE.md](CLAUDE.md).

## Layout

```text
README.md                 map: Start, design vs MVP, doc trail
docs/pt-br/00–12          design trail (Portuguese first)
docs/adr/                 decisions (do not silently replace)
apps/backend/             Fastify gateway + write-through + WS
apps/web/                 React client as a system node (auth/, chat/, shared/)
.agents/personas/         optional scoped blast radius, one at a time
```

## Do

- Read docs 01–10 and the relevant ADR before adding a capability.
- Keep trade-offs explicit (why X instead of Y). Persist and mint `sequence` before fan-out.
- Be honest about what the running process does vs what the design promises.
- Load at most one persona from `.agents/personas/` for a scoped refactor.

## Don't

- Do not invent Event Bus, membership isolation, or 10k–50k capacity in the running MVP without an ADR and tests.
- Do not turn the README into an XSS/session essay or paste Related links to agentic sibling repos.
- Do not add Purpose/Propósito bilingual blocks.
- Do not rewrite the Portuguese 01–10 trail unless a claim is false.
- Do not commit to `main`; open a PR. A feature is not done without recovery + documented trade-off + invariant check.
