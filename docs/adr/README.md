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
| [005](./005-initial-tech-stack-and-persistence.md) | Definição da Stack Inicial MVP | Aceito |
| [006](./006-defer-auth-for-backfill-sync.md) | Adiamento Autenticação vs Backfill | Aceito |



## Regras

- **Idioma:** Português. Termos técnicos em inglês.
- **Tamanho:** 1-2 páginas. Se precisar mais, considere um RFC.
- **Evolução:** Nunca apague. Marque como "Substituído por ADR-XXX".
- **Status:** Proposto → Aceito → Depreciado | Substituído por ADR-XXX
