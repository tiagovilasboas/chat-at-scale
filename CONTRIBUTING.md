# Contribuindo

Obrigado pelo interesse. Este projeto segue as regras de Principal Engineering e Frontend Architecture Playbook.

## Gate: antes de implementar

**Não codifique até que todos os docs 01-10 existam e estejam prontos.**

| # | Pré-requisito | Doc |
|---|---------------|-----|
| 1 | Problema definido | [01 - Definição do Problema](./docs/pt-br/01-problem-definition.md) |
| 2 | Invariantes do sistema | [02 - Invariantes](./docs/pt-br/02-system-invariants.md) |
| 3 | Trade-offs | [03 - Trade-offs](./docs/pt-br/03-trade-offs.md) |
| 4 | Arquitetura | [04 - Arquitetura](./docs/pt-br/04-architecture.md) |
| 5 | Modelo de mensagens | [05 - Modelo de Mensagens](./docs/pt-br/05-messaging-model.md) |
| 6 | Escalabilidade | [06 - Escalabilidade](./docs/pt-br/06-scalability.md) |
| 7 | Cenários de falha | [07 - Cenários de Falha](./docs/pt-br/07-failure-scenarios.md) |
| 8 | Responsabilidades do frontend | [08 - Frontend](./docs/pt-br/08-frontend-as-a-system.md) |
| 9 | Observabilidade | [09 - Observabilidade](./docs/pt-br/09-observability.md) |
| 10 | Evolução | [10 - Evolução](./docs/pt-br/10-evolution.md) |

Problema primeiro, código depois.

## Feature pronta: checklist antes de merge

Uma funcionalidade só está pronta quando todos os itens estão ok:

- [ ] Funciona (happy path e recuperação)
- [ ] Trade-offs documentados (ADR ou doc)
- [ ] Cenários de falha considerados
- [ ] Invariantes respeitados (cada um com teste ou verificação)

Ver [02 - Invariantes](./docs/pt-br/02-system-invariants.md) (Checklist de validação) para o que validar por invariante.

## Segurança (ao implementar)

- **Isolamento (INV-002):** Mensagens só para membros da conversa; validar membership em todo fan-out.
- **Input:** Sanitizar e validar; evitar injection (SQL, XSS se houver renderização de conteúdo).
- **Auth:** Assume OAuth/JWT; token validado no Gateway antes de aceitar conexão.
- **Dados sensíveis:** Sem conteúdo de mensagem em logs (privacidade). Ver [09 - Observabilidade](./docs/pt-br/09-observability.md).

## Documentação e ADRs

- **Idioma:** Português. Termos técnicos em inglês.
- **ADRs:** Decisões de framework, build, deploy, estrutura: crie ADR em `docs/adr/`.
- **Travessão:** Só na numeração (00 - Título). Em parágrafos, use vírgula ou dois pontos.

## Referências

- [00 - Regras Principais](./docs/pt-br/00-principal-engineering-rules.md)
- [.cursor/rules](./.cursor/rules/) (Principal Engineering, Frontend Playbook)
