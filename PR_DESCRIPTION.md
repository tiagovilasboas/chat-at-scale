# feat: Stateful Authentication Gateway (Phase 4)

## A Jornada do Usuário (Regras de Negócio)

A autenticação foi desenhada para garantir uma experiência fluída, segura e atômica. Abaixo estão as regras de negócio mapeadas na jornada do usuário:

### 1. Criando uma conta (Registro)
- **Regra**: O sistema exige um `username` absoluto e único. Tentar registrar um nome já existente barra a requisição de imediato.
- **Segurança**: Em vez de guardar as senhas no banco, o sistema aplica um processamento criptográfico (`scrypt`) criando uma digital irreversível e atrelada a uma "chave de sal" aleatória.

### 2. Entrando no sistema (Login)
- **Regra**: O usuário provê credenciais corretas e recebe uma **Autorização de 7 dias** (representada pelo token JWT).
- **Rastreabilidade**: Ao longo desses 7 dias, a sessão do usuário fica rastreada no banco de dados. Isso permite saber exatamente quantos dispositivos o usuário conectou.
- **Experiência (Frontend)**: Uma vez logado, o "Crachá" (Token) fica gravado no navegador. Se o usuário fechar a aba e voltar amanhã, ele será **direcionado imediatamente para o Chat**, sem passar pela tela de login de novo.

### 3. Conectando ao Chat (A Porta do WebSocket)
- **Regra de Acesso**: O Chat não confia em ninguém. Ao tentar abrir a conexão via WebSocket, o usuário deve apresentar o seu Crachá (Token) na "porta".
- **Rejeição sumária**: Se o crachá estiver expirado, for falso ou não existir, a porta não abre. A conexão é recusada com `1008 Policy Violation`, protegendo o servidor de abusos.

### 4. Saindo do sistema (Logout / Revogação)
- **Regra**: Quando o usuário clica em "Sign out", o sistema destrói as mensagens sensíveis da tela do chat e joga o crachá do navegador fora.
- **Revogação (Poder Administrativo)**: Graças ao mecanismo de tracking no banco, a administração do sistema possui o poder de "**Revogar**" a sessão de um usuário a qualquer instante antes dos 7 dias, derrubando a conexão dele em tempo-real.

---

## Como Funciona

### Arquitetura do Frontend (Screaming Arch & Zustand)

O frontend foi re-estruturado para focar em **domínios de negócio**, abandonando a estrutura técnica clássica (pastas de `components/`, `hooks/`, `services/`).

```
src/
├── auth/              # Domínio de autenticação
│   ├── services/      # authService — único HTTP client de login
│   ├── store/         # useAuthStore — estado global da sessão
│   └── pages/Login/   # UI pura, não sabe como funciona o HTTP
├── chat/              # Domínio do chat
│   ├── hooks/         # useWebSocket — zero useState, puro side-effect
│   └── store/         # useChatStore — banco local de mensagens
```

#### Zustand vs Context API vs Padrão Singleton Vanilla
Usávamos `useState` cascateado que forçava prop-drilling pelo `App.tsx`. A evolução natural seria a **Context API**, contudo ela amarra o estado à React Tree inteira, engatilhando re-renders globais desnecessários e ferindo a performance sistêmica do chat.

*"Por que então não usar um Singleton baseado em Classes (Vanilla JS)?"*
Se usássemos um Singleton estático clássico (`AuthService.getInstance()`), a "reatividade" seria quebrada. O motor do React é cego a mutações de variáveis em Classes Vanilla. Para forçar o React a "escutar" um Singleton externo, seríamos forçados a acoplar lógicas de `EventEmitter` (Pub/Sub) e `useSyncExternalStore` manualmente.

O **Zustand** atua exatamente como um Singleton externalizado perfeito da React Tree, mas injeta nativamente o padrão `Pub/Sub` resolvendo a engrenharia reativa. Ele nos permite atualizações cirúrgicas: hooks que escutam exclusivamente a variável `token` se atualizam, sem vazar renderizações pesadas para elementos que só escutam o `username`.

Além disso, usamos o middleware `persist` do Zustand:
```ts
localStorage["chat-auth"] = { state: { session: { token, userId, username } } }
```
Com isso, no próximo boot a sessão é reidratada **antes do primeiro render**, eliminando o flash de "tela de login" para quem já estava logado. Zero requisições de rede no boot, zero `useEffect` de reidratação.

#### Resiliência do WebSocket (O caso do React StrictMode)
```ts
useEffect(() => {
  let shouldConnect = true  // ← guard contra double-mount
  
  const socket = new WebSocket(...)
  socket.onopen = () => { if (!shouldConnect) return; ... }
  
  return () => { shouldConnect = false; socket.close(); }
}, [])
```
Em dev, o React StrictMode monta e desmonta o `useEffect` duas vezes instantaneamente. Se a conexāo tentar abrir mas o componente "morrer" antes do `onopen`, o browser deixará um socket fantasma em estado de `CONNECTING` (readyState 0). A flag `shouldConnect` anula callbacks atrasados e garante o fechamento fluído no unmount.

### Registro e Login (Backend)

```
POST /api/auth/register  →  cria users row (password_hash via scrypt)
POST /api/auth/login     →  verifica hash → gera JWT → salva em sessions
                            retorna: { token, userId, username }
```

### Sessão no Banco de Dados (Backend)

```sql
sessions (
  id         UUID PRIMARY KEY,
  user_id    → FK users.id,
  token      VARCHAR(1024) UNIQUE,  -- JWT completo indexado
  expires_at TIMESTAMP,             -- login + 7 dias
  revoked_at TIMESTAMP NULL         -- NULL = ativa
)
```

**Expiração dupla**: o JWT carrega `exp` embutido (validado pelo `jsonwebtoken.verify()` automaticamente) e o banco tem `expires_at` que permite expiração antecipada por revogação de conta.

### Gateway WebSocket (Backend)

```
ws://host:8080/ws?token=<JWT>
  ↓
1. Token presente? → não: close(1008)
2. Assinatura JWT válida? → não: close(1008)
3. Conecta, envia mensagem `{ type: 'connected' }`
4. Aguarda mensagem `{ type: 'sync', cursor: N }` → responde com mensagens perdidas
```

O token vai no query param porque browsers não permitem headers customizados em WebSocket upgrades.

### Variáveis de Ambiente

| Arquivo | Variável | Padrão local |
|---|---|---|
| `apps/backend/.env` | `JWT_SECRET` | `staff_principal_secret` |
| `apps/backend/.env` | `DATABASE_URL` | `postgres://chat:password@localhost:5432/chat_at_scale` |
| `apps/web/.env` | `VITE_API_URL` | `http://localhost:8080` |
| `apps/web/.env` | `VITE_WS_URL` | `ws://localhost:8080` |

Copie os arquivos `.env.example` em cada `apps/` para criar o `.env` local. **Nunca comite `.env`**.

---

## Como Testar

```bash
# 1. Subir infraestrutura
docker compose up -d

# 2. Aplicar schema no banco
cd apps/backend && npx drizzle-kit push

# 3. Subir backend e frontend
cd apps/backend && npm run dev
cd apps/web && npm run dev
```

Acesse `http://localhost:5173`:

1. **Registro**: clique em "Create a new account", preencha username e password, envie
2. **Login**: volte para Sign in, use as mesmas credenciais
3. **Chat**: após login, o chat abre com status verde quando o WebSocket conecta
4. **Logout**: "Sign out" limpa a sessão local e retorna ao Login

---

## Arquivos Alterados

**Backend**
- `infrastructure/db/schema.ts` — tabelas `users` (+ `password_hash`) e `sessions`
- `infrastructure/http/auth.ts` — `POST /api/auth/register`, `POST /api/auth/login`, `setErrorHandler` global
- `infrastructure/http/auth.spec.ts` — **[NEW]** Testes unitários p/ `hashPassword` e `verifyPassword`
- `infrastructure/websocket/handler.ts` — validação JWT no gateway

**Frontend**
- `auth/store/authStore.ts` — Zustand + persist (sessão global, logout limpa chatStore)
- `auth/store/authStore.spec.ts` — **[NEW]** Testes unitários garantindo persistência e limpeza profunda
- `auth/services/auth.ts` — HTTP client para register/login
- `auth/pages/Login/index.tsx` — UI com toggle register/login, loading state, feedback visual
- `chat/store/chatStore.ts` — mensagens, deduplicação, backfill por sequence cursor
- `chat/hooks/useWebSocket.ts` — ciclo de vida WS, guard contra StrictMode double-mount
- `chat/pages/Chat/index.tsx` — UI Discord/Linear, mensagens agrupadas, avatars, auto-scroll
- `shared/components/ErrorBoundary.tsx` — captura erros de render

**Config**
- `apps/backend/.env.example` — template de variáveis de ambiente
- `apps/web/.env.example` — template de variáveis de ambiente (VITE_ prefix)
- `src/index.css` — dark mode forçado, paleta indigo-violet
- `.husky/pre-commit` — **[NOVO GATE]** Execução automática de `npm test` para frontend e backend

---

## Checklist

- [x] Registro e login sem lib de auth terceirizada (node:crypto scrypt + jsonwebtoken)
- [x] Sessão persistida no PostgreSQL (`expires_at`, `revoked_at`)
- [x] Token no frontend via Zustand persist (zero localStorage manual)
- [x] Logout limpa sessão local e estado de chat
- [x] Gateway WS valida JWT antes de alocar memória
- [x] Variáveis de ambiente via `.env` (gitignored) + `.env.example`
- [x] `ErrorBoundary` para erros de render
- [x] `setErrorHandler` global no Fastify (sem stack traces em produção)
- [x] **[TESTS]** TypeScript + ESLint + Vitest Unit Tests 100% passando no pre-commit gate
- [ ] DB session check no WS (JWT stateless funcionando; DB check → Fase 5 com Redis)
- [ ] Endpoint `DELETE /api/auth/session` para revogação via API (Fase 5)
