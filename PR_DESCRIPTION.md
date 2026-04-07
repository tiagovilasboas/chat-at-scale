# feat: Stateful Authentication Gateway — Fase 4

## Problema

O sistema não tinha autenticação. Qualquer conexão WebSocket era aceita sem validação de identidade. Isso expunha o servidor a:
- Slowloris attacks (conexões maliciosas consumindo memória indefinidamente)
- Spoofing (mensagens sendo enviadas em nome de qualquer usuário)

---

## Regras de Negócio Implementadas

| Regra | Onde é aplicada |
|---|---|
| Um usuário precisa de username único para se registrar | `POST /api/auth/register` → Postgres UNIQUE constraint |
| A senha nunca é armazenada em texto plano | `scrypt` com salt aleatório — salvo como `"hash.salt"` |
| O login retorna um token com validade de 7 dias | JWT HS256 com claim `expiresIn: '7d'` |
| Cada sessão é rastreada individualmente no banco | Tabela `sessions` com `user_id`, `token`, `expires_at`, `revoked_at` |
| Uma sessão pode ser revogada antes de expirar | `revoked_at` nullable — NULL = ativa, NOT NULL = inválida |
| Nenhuma conexão WebSocket é aceita sem uma sessão válida | Gateway valida assinatura JWT antes de alocar memória |
| O servidor nunca confia no que o cliente diz sobre quem é | A identidade vem sempre do JWT decodificado, nunca de parâmetros enviados pelo cliente |
| Tokens com assinatura inválida ou expirados são rejeitados com `1008 Policy Violation` | `jwt.verify()` no handshake WS |

---

## Como Funciona

### Registro e Login

```
POST /api/auth/register  →  cria users row (password_hash via scrypt)
POST /api/auth/login     →  verifica hash → gera JWT → salva em sessions
                            retorna: { token, userId, username }
```

### Sessão no Banco de Dados

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

### Gateway WebSocket

```
ws://host:8080/ws?token=<JWT>
  ↓
1. Token presente? → não: close(1008)
2. Assinatura JWT válida? → não: close(1008)
3. Conecta, envia mensagem `{ type: 'connected' }`
4. Aguarda mensagem `{ type: 'sync', cursor: N }` → responde com mensagens perdidas
```

O token vai no query param porque browsers não permitem headers customizados em WebSocket upgrades.

### Persistência no Frontend

O token retornado pelo login é salvo automaticamente via Zustand `persist` middleware:
```
localStorage["chat-auth"] = { state: { session: { token, userId, username } } }
```

No próximo boot do app, o estado é reidratado antes da primeira renderização — sem flash de UI, sem round-trip de rede.

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
