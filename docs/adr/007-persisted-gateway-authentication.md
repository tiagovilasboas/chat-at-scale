# ADR 007: Persisted Gateway Authentication & Session Modeling

## Status
Aceito, parcialmente implementado (atualizado em 2026-09-08)

## Contexto

O design primário da Camada de Segurança exigia proteção "Zero-Trust" contra WebSockets não autorizados. Arquiteturas state-of-the-art recusam JWT puramente stateless por causa do "Problema da Revogação": se um token é roubado, o Gateway aceitará o intruso até a expiração matemática do JWT. Num chat massivo, precisamos da capacidade atômica de derrubar sessões instantaneamente.

## Decisão Técnica

Adotamos o padrão de **Bifurcação de Estado (Dual-Layer Persistence)**:

### Backend: Postgres `sessions` table + HttpOnly cookie

```sql
sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR → FK users.id,
  token       VARCHAR(1024) UNIQUE,   -- JWT completo indexado para lookup O(1)
  expires_at  TIMESTAMP NOT NULL,     -- login + 7 dias
  created_at  TIMESTAMP DEFAULT NOW(),
  revoked_at  TIMESTAMP NULL          -- NULL = ativa | NOT NULL = revogada
)
```

O JWT **não** viaja em `?token=` nem no body JSON do login. O browser guarda o crachá num cookie `HttpOnly`, `SameSite=Lax`, `Path=/`. JavaScript da página não lê o valor. O proxy Vite (`/api` e `/ws`) é same-origin, então o cookie segue nas chamadas HTTP e no upgrade WebSocket sem o cliente copiar o token.

**Ciclo de vida de uma sessão:**
1. `POST /api/auth/register` → cria `users` row com `password_hash` via `scrypt` nativo do Node (mínimo de 8 caracteres)
2. `POST /api/auth/login` → `verifyPassword` com `crypto.timingSafeEqual`, gera JWT HS256 `{ userId, expiresIn: '7d' }`, **um** insert em `sessions`, `Set-Cookie: token=...`
3. WebSocket `/ws` → servidor lê `req.cookies.token` e valida **somente** a assinatura/expiração JWT. Sem query string.
4. `POST /api/auth/logout` → lê o token do cookie, `UPDATE sessions SET revoked_at = NOW()`, `clearCookie('token')`

### Frontend: Zustand `persist` só com metadados

O store **não** guarda JWT. Persistência é só identidade de UI:

- **Chave localStorage**: `chat-auth`
- **Formato**: `{ state: { session: { userId, username } } }`
- **Reidratação**: acontece antes da primeira renderização, sem flash de tela de login
- **Limpeza**: Sign out chama `authService.logout()` (`credentials: 'include'`) e depois `set({ session: null })`

O token vive só no cookie HttpOnly. XSS na página não consegue `localStorage.getItem` do JWT porque ele não está lá.

## Estado Atual da Implementação (Fase 4)

| Componente | Status | Notas |
|---|---|---|
| Tabela `users` com `password_hash` | ✅ | scrypt nativo (sem bcrypt C++) |
| Tabela `sessions` com `expires_at` e `revoked_at` | ✅ | Schema Drizzle + uniqueIndex no token |
| `POST /api/auth/register` | ✅ | Conflito de username → 409; senha curta → 400 |
| `POST /api/auth/login` | ✅ | Cookie HttpOnly + um insert em `sessions` |
| `POST /api/auth/logout` | ✅ | Limpa cookie **e** seta `sessions.revoked_at` |
| CORS credentialed | ✅ | `CORS_ORIGIN` (default `http://localhost:5173`); nunca `*` com `credentials: true` |
| Zustand persist no frontend | ✅ | Só `{ userId, username }`. Sem JWT no localStorage |
| WS handshake | ✅ | Cookie HttpOnly via proxy Vite. JWT verify only |
| WS com DB/Redis session check | ⏳ | **Não implementado.** Fase 5: cache Redis para revogação instantânea no gateway. Não inventar Redis agora. |

## O que a Fase 4 deliberadamente não faz

Logout revoga a row no Postgres e apaga o cookie do browser. Isso impede o **mesmo browser** de reenviar o crachá. O gateway WebSocket **ainda não consulta** `sessions.revoked_at`. Consequência: um JWT copiado por outro canal (ou um socket já aberto) continua aceito até o `exp` de 7 dias. Isso é dívida explícita da Fase 5, não um check verde falso.

CORS no backend existe para o caso de o cliente falar direto com `:8080`. No fluxo local padrão (Vite em `:5173` fazendo proxy de `/api` e `/ws`), as requests são same-origin e o cookie flui sem CORS.

## Consequências

**Positivas:**
- XSS deixa de ser vetor trivial de roubo de sessão (token fora do localStorage)
- Logout de verdade no banco: a row fica auditável e pronta para o check da Fase 5
- Rastreio forense: múltiplas sessões por usuário são identificáveis
- Dupla expiração no modelo: JWT claim (stateless) + DB timestamp (stateful)

**Trade-offs:**
- Enquanto o WS for JWT-only, revogação no DB **não** derruba conexões já autenticadas nem tokens extraídos por outro meio
- I/O adicional no Postgres no login/logout (aceitável na Fase 4; o hotspot seria o handshake WS em C10K)
- **Mitigação planejada (Fase 5)**: Redis (ou equivalente) como cache de sessão no gateway, consultado no handshake. Sem Redis nesta PR.

## Referências

- `apps/backend/src/infrastructure/db/schema.ts`: definição das tabelas
- `apps/backend/src/infrastructure/http/auth.ts`: register, login, logout
- `apps/backend/src/infrastructure/http/cors-origin.ts`: origem explícita, nunca `*`
- `apps/backend/src/infrastructure/websocket/handler.ts`: JWT verify no cookie, sem DB
- `apps/web/src/auth/store/authStore.ts`: persist só de metadados
- `apps/web/src/auth/services/auth.ts`: `credentials: 'include'`
