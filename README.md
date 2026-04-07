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

---

## 🔐 Session Persistence & Expiration

A autenticação opera em **duas camadas complementares de persistência**:

### Camada 1 — Backend (PostgreSQL)

Ao fazer login, o servidor cria um registro na tabela `sessions`:

```sql
-- Schema Drizzle ORM
sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR → FK users.id,
  token       VARCHAR(1024) UNIQUE,   -- o JWT completo
  expires_at  TIMESTAMP NOT NULL,     -- agora + 7 dias
  created_at  TIMESTAMP DEFAULT NOW(),
  revoked_at  TIMESTAMP NULL          -- NULL = sessão ativa
)
```

**Expiração**: o campo `expires_at` é calculado em `Date.now() + 7 * 24h` no momento do login. Além disso, o próprio JWT carrega a claim `expiresIn: '7d'` — logo a validação dupla acontece:
1. `jsonwebtoken.verify()` rejeita automaticamente tokens cujo `exp` já passou (stateless)
2. A query no banco verifica `expires_at < NOW()` (stateful — permite expiração antecipada por revogação)

**Revogação**: para invalidar uma sessão antes do prazo (ex: logout forçado por segurança), basta setar `revoked_at = NOW()` na linha. O gateway WS checa `revokedAt IS NULL` em cada reconexão.

### Camada 2 — Frontend (Zustand Persist → localStorage)

O `useAuthStore` usa o middleware `persist` do Zustand:

```ts
persist(
  (set) => ({ session: null, login, logout }),
  { name: 'chat-auth' }  // ← chave no localStorage
)
```

O `localStorage['chat-auth']` armazena:
```json
{ "state": { "session": { "token": "eyJ...", "userId": "usr_...", "username": "..." } }, "version": 0 }
```

No boot da aplicação, o Zustand reidrata o estado antes da primeira renderização (zero `useEffect`, zero flash de UI). No logout, `set({ session: null })` limpa o store e o Zustand persist apaga o `localStorage` automaticamente.

### Fluxo completo de uma sessão

```
Register → users + sessions criados (expires_at = +7d)
Login    → nova sessions row + JWT emitido → localStorage via Zustand persist
Boot     → Zustand lê localStorage → token presente → Chat direto (sem round-trip)
WS       → ?token=JWT → servidor verifica assinatura JWT → conexão aceita
Logout   → Zustand limpa localStorage → App redireciona para Login
Expirou  → jwt.verify() rejeita → WS fecha 1008 → App redireciona para Login
```

> *Consulte **`docs/adr/007-persisted-gateway-authentication.md`** para o racional completo da decisão de autenticação stateful vs. stateless.*

---

> *Consulte as Atas Arquiteturais Oficiais (ADRs) em **`docs/adr/`** para as decisões de design que fundamentam essa arquitetura.*
