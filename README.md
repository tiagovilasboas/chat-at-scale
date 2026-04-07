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

## 🚦 Executando Localmente (MVP & Autenticação)

O código base inicial (Clean Architecture) já está implementado contendo: **PostgreSQL**, **API Gateway (Fastify API & WS)** com proteção de sessão e **Cliente Web (React Vite / Shadcn UI)** estruturado em domínios isolados.

1. **Iniciando a Infraestrutura e Banco**:
   ```bash
   npm i
   docker compose up -d
   cd apps/backend && npx drizzle-kit push && cd ../.. 
   ```

2. **Iniciando os Servidores (Monorepo)**:
   ```bash
   npm run dev --workspace=apps/backend
   npm run dev --workspace=apps/web
   ```

O cliente do App Web estará responsivo aguardando interação em **[http://localhost:5173](http://localhost:5173)**, fazendo proxy localmente e nativamente para a retaguarda blindada no Node `http://localhost:8080`. Toda a arquitetura foi desenhada priorizando D.X (Developer Experience).

---

## 🔐 Session Persistence & Arquitetura (Dual-Token Pattern)

A autenticação opera em **duas camadas complementares de persistência**, focadas em mitigar riscos graves de invasão (XSS) e paralelamente manter a fluidez instantânea de navegação que o Usuário de UI moderna necessita (O Zero-Loading):

### Camada 1 — Backend (PostgreSQL & Fastify HttpOnly)

Ao fazer login (usando Node Native `scrypt` hash system), o servidor cria um registro na tabela `sessions` (`token`, `expires_at`, `revoked_at`). O JWT master gerado é então empacotado e enviado de volta ao Chrome por um **Cookie `HttpOnly`**: blindado, imutável e 100% invisível ao Javascript frontend. Se por ventura um hacker injetar pacotes NPM maliciosos (XSS), seu Token não poderá ser clonado da memória local.

**Expiração Dupla**: O JWT nativamente carrega a diretiva `expiresIn: 7d` (Validado Sem I/O de Banco, escalável e Rápido no WS Gateway). O banco adicionalmente checa o `revoked_at`, propiciando revogabilidade forçada em nível administrativo.

### Camada 2 — Frontend (Zustand Persist → Local Metadata)

Se não possuímos o Token no Frontend, como o site sabe que você logou ontem ao invés de piscar na clássica e inconveniente Tela de Login ("Flash of unauthenticated content") gerando re-renders visuais lentos?

Utilizamos o **Zustand Persist** que injeta no `localStorage['chat-auth']` inteiramente os **Metadados em Cache** locais:
```json
{ "state": { "session": { "userId": "usr_...", "username": "John Doe" } }, "version": 0 }
```
Assim que você entra no site, o Motor de Renderização já injeta seu Nome e Avatar sincronamente (`0.02ms`), mas ao se conectar com o WebSocket, o Navegador insere o seu `HttpOnly Cookie` original e envia sem você tocar. O melhor dos 2 mundos.

> *Consulte **`docs/adr/007-persisted-gateway-authentication.md`** para detalhes técnicos e diagramas.*

---

## 🤖 Estrutura Multi-Agents (AI Driven)

Este repositório adota configurações de engajamento assíncrono para LLMs de última geração (Claude Code, Cursor, Windsurf).
- As diretrizes globais da arquitetura Staff/Principal residem no `CLAUDE.md`.
- As matrizes segmentadas especializadas (Frontend, Backend, DBA e QA) residem na pasta estrita `.agents/personas/`. Quando utilizar IAs para refatorações setoriais, recomende-as importar diretamente seus manuais isolados limitando o blast radius arquitetural de falucinação do modelo.

---

Feito com ❤️ por [**Tiago Vilas Boas**](https://github.com/tiagovilasboas) e uma galera de agentes co-pilotos. [MIT](LICENSE)
