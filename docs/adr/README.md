# Architecture Decision Records (ADRs)

Decisões arquiteturais formais do projeto. Cada ADR documenta contexto, decisão, alternativas e consequências.

## Template

Use o template em [template.md](./template.md) para novos ADRs.

## Índice

| ADR | Título | Status |
|-----|--------|--------|
| [001](./001-websocket-primario.md) | WebSocket como protocolo primário | Aceito |
| [002](./002-at-least-once.md) | Garantia de entrega at-least-once | Aceito |
| [003](./003-ordem-total-por-conversa.md) | Ordem total por conversa | Aceito |
| [004](./004-persistencia-write-through.md) | Persistência write-through | Aceito |

## ADRs futuros (frontend)

Ao implementar o cliente, criar ADRs para:

- **Framework:** React, Vue, etc. e motivo da escolha
- **Build e tooling:** Vite, Webpack, etc.
- **Deploy:** Vercel, S3+CloudFront, etc.
- **Estrutura de pastas:** Feature-based, Dependency Rule, camadas

Requerimento do [Frontend Architecture Playbook](https://frontend-architecture-playbook-eight.vercel.app/). Ver `.cursor/rules/frontend-architecture-playbook.mdc`.

## Regras

- **Idioma:** Português. Termos técnicos em inglês.
- **Tamanho:** 1–2 páginas. Se precisar mais, considere um RFC.
- **Evolução:** Nunca apague. Marque como "Substituído por ADR-XXX".
- **Status:** Proposto → Aceito → Depreciado | Substituído por ADR-XXX
