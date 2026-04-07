# 🚀 Chat at Scale - A Staff-Level Architecture

> Um laboratório de Engenharia de Software Avançada, focado em alta disponibilidade, resiliência assíncrona e integração nativa com Ecossistemas de Múltiplos Agentes de IA.

## 🎯 A Filosofia (Principal Engineering)
Este repositório não é um "tutorial de Websockets". É uma resposta estrutural aos problemas reais de aplicações em hiperescala (10k - 50k conexões simultâneas). Nós documentamos os *trade-offs*, banimos as *magic-boxes* e operamos sob as restrições mais brutais de confiabilidade:
* **Zero-Trust Client**: O servidor confia dogmaticamente no banco de dados, nunca nos *timestamps* ou metadados de UI do frontend.
* **Fallacies of Distributed Computing**: Desenhamos a mecânica de *recuperação* (Backfill) preventivamente para assumir quedas drásticas de conectividade.
* **Estado Monotônico (Sequence)**: A escalabilidade começa pela ordenação inquebrável atômica das mensagens no armazenamento relacional, isolando os Brokers de conflitos *race-conditions*.

## 🏗️ Topologia e Módulos (Monorepo)

O ecossistema é gerenciado globalmente via **NPM Workspaces**, blindando contextos estritos:

### 1. `apps/backend` (Gateway & Mensageria)
*   **Stack**: Node.js + Fastify + `@fastify/websocket` (Priorizando I/O de alta densidade).
*   **Database**: PostgreSQL 16 + Drizzle ORM.
*   **Design Pattern**: Clean Architecture Base (Domain, UseCases, Infrastructure). O fluxo de rede Fastify jamais penetra nas regras de negócio estritas.
*   **Write-Through Persistence**: Toda mensagem toca o disco e recebe uma `sequence` atômica *antes* de sofrer o *fan-out* broadcast para os sockets abertos, prevenindo perda catastrófica de histórico durante quedas fatais do Node Master.

### 2. `apps/web` (Client Node)
*   **Stack**: React 19 + React Compiler + Vite
*   **UI/UX**: TailwindCSS v4 + Shadcn UI Primitives
*   **Resiliência Ativa**: O frontend atua como um nó distribuído inteligente. Em cada evento de reconexão `ws.onopen()`, ele varre a matriz, calcula dinamicamente o seu *Cursor Local* e dispara explicitamente um **Hydration Sync Request** (Backfill) focado em injetar linearmente o GAP de mensagens perdidas.

## 🤖 Ecossistema Multi-Agentes (AI-Native Ecosystem)
Este repositório foi construído e configurado estruturalmente para Agentes de Inteligência Artificial de Nível 3 (Claude Code, Cursor, Windsurf) habitarem.
* **Diretrizes Globais do Staff**: Todas residentes no `CLAUDE.md`, limitando impulsos sintéticos e focando IAs a mapearem os gargalos antes do I/O de escrita.
* **Módulos de Personas Diferenciadas**: Armazenadas na pasta secreta `.agents/personas/`, temos arquitetos de escopo hiper-focado (Frontend, Backend, DBA e QA/Safety). Ao cruzar LLMs locais a este repositório, delegamos seus *System Prompts* para lerem esses arquivos nativamente, limitando e otimizando exponencialmente a capacidade de raciocínio.

## 🛡️ Segurança e Qualidade Contínua (CI)
1. **Autenticação Stateful Defensiva**: Nós rechaçamos arquiteturas de Sockets publicamente ignorantes esperando um pacote de credenciais JSON ("*Slowloris Attack Loop*"). Nosso Token JWT é trocado assincronamente via API HTTP (`/api/auth`) e injetado mandatoriamente na *QueryString* do Socket (`ws://?token=XYZ`). Todo pacote de memória do Servidor restringe o acesso através de consultas criptográficas rápidas às sessões do Postgres.
2. **Husky Pipelines**: *Pre-commit hooks* blindados em V8. É sistemicamente bloqueado enviar código ferindo os *Gates* assíncronos do TypeScript (`tsc --noEmit`) ou quebrando as barreiras modulares de Renderização do `Eslint`.

---

## 🚦 Como Rodar Localmente

1. **Pré-requisitos Operacionais**:
   * Node.js v20+ / Docker / Docker Compose

2. **Iniciando a Infraestrutura**:
   ```bash
   docker-compose up -d
   ```
   *O cluster do PostgreSQL 16 será iniciado e atachado permanentemente à porta 5432.*

3. **Injeção de Migrações de Banco (MVP)**:
   ```bash
   npm i
   cd apps/backend
   npx drizzle-kit push
   ```

4. **Boot dos Workspaces**:
   Volte para a raiz e engatilhe ambos os containers node paralelamente:
   ```bash
   npm run dev --workspace=apps/backend
   npm run dev --workspace=apps/web
   ```

O cliente do App Web estará responsivo aguardando interação em **[http://localhost:5173](http://localhost:5173)**, servindo à retaguarda blindada do interceptor WSS no Node `ws://localhost:8080/ws`.

> *Consulte as Atas Arquiteturais Oficiais (ADRs) documentando profundamente como preterimos bibliotecas mágicas em prol da Engenharia de Raiz visitando os sub-diretórios presentes em **`docs/adr/`**.*
