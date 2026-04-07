# ADR 007: Persisted Gateway Authentication & Session Modeling

## Status
Aceito — Parcialmente implementado (atualizado em 2026-04-07)

## Contexto

O design primário da Camada de Segurança exigia proteção "Zero-Trust" contra WebSockets não autorizados. Arquiteturas state-of-the-art recusam JWT puramente stateless por causa do "Problema da Revogação": se um token é roubado, o Gateway aceitará o intruso até a expiração matemática do JWT. Num chat massivo, precisamos da capacidade atômica de derrubar sessões instantaneamente.

## Decisão Técnica

Adotamos o padrão de **Bifurcação de Estado (Dual-Layer Persistence)**:

### Backend: Postgres `sessions` table

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

**Ciclo de vida de uma sessão:**
1. `POST /api/auth/register` → cria `users` row com `password_hash` via `scrypt` nativo do Node
2. `POST /api/auth/login` → verifica hash, gera JWT HS256 `{ userId, expiresIn: '7d' }`, insere row em `sessions`
3. WebSocket `?token=JWT` → servidor valida assinatura JWT **e** consulta `sessions WHERE token = ? AND revoked_at IS NULL`
4. Logout → `UPDATE sessions SET revoked_at = NOW()` (revogação imediata)

### Frontend: Zustand `persist` middleware

O token retornado pelo login é armazenado no `useAuthStore` com persist:
- **Chave localStorage**: `chat-auth`
- **Reidratação**: acontece antes da primeira renderização (lazy state initializer), sem flash de UI
- **Limpeza**: `logout()` chama `set({ session: null })` — o Zustand persist apaga o localStorage automaticamente

## Estado Atual da Implementação (Fase 4)

| Componente | Status | Notas |
|---|---|---|
| Tabela `users` com `password_hash` | ✅ | scrypt nativo (sem bcrypt C++) |
| Tabela `sessions` com `expires_at` e `revoked_at` | ✅ | Schema Drizzle + uniqueIndex no token |
| `POST /api/auth/register` | ✅ | Conflito de username → 409 |
| `POST /api/auth/login` | ✅ | Dupla expiração: JWT claim + DB `expires_at` |
| Zustand persist no frontend | ✅ | Chave `chat-auth`, reidratação automática |
| WS com DB session check | ⏳ | Implementado mas substituído por JWT stateless para debugging. Fase 5: Redis cache |
| Revogação via `revoked_at` | ⏳ | Estrutura de DB pronta. Endpoint `DELETE /api/auth/session` — Fase 5 |

## Consequências

**Positivas:**
- Permite revogação instantânea (banimento, logout forçado de todos os devices)
- Rastreio forense: múltiplas sessões por usuário são identificáveis
- Dupla expiração: JWT claim (stateless) + DB timestamp (stateful) previnem tokens "zumbis"

**Trade-offs:**
- I/O adicional no Postgres para cada nova conexão WS
- Em cenário C10K agressivo, o `sessions` table pode se tornar hotspot  
- **Mitigação planejada (Fase 5)**: Redis cluster como cache de sessão — elimina DB round-trip para 95%+ das conexões

## Referências

- `apps/backend/src/infrastructure/db/schema.ts` — definição das tabelas
- `apps/backend/src/infrastructure/http/auth.ts` — registro e login
- `apps/backend/src/infrastructure/websocket/handler.ts` — validação JWT no gateway
- `apps/web/src/auth/store/authStore.ts` — persist middleware no frontend
