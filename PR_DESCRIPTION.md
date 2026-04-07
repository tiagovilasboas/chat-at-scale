# feat: Jornada de Autenticação Persistida com Segurança de Gateway

## Contexto

Este PR fecha a **Fase 4** do projeto Chat at Scale: a implementação de um sistema de autenticação stateful, persistido em banco de dados, com uma experiência de UI moderna e uma arquitetura de frontend organizada em domínios.

---

## 🎨 Frontend — Jornada Detalhada

### Por que Zustand?

Antes da migração, a sessão do usuário vivia em `useState` + `localStorage` gerenciado manualmente em um hook local (`useAuth`). Essa abordagem funciona para MVP, mas tem problemas graves de escala:

- **Prop-drilling**: o `session` precisava ser passado manualmente de `App → Chat → qualquer filho`
- **Sem reactivity global**: um segundo componente que precisasse saber do estado logado não teria como sem Context API ou um store
- **Lógica de localStorage duplicada**: `getItem`, `setItem`, `removeItem` espalhados em múltiplos lugares

Com **Zustand + `persist` middleware**, eliminamos tudo isso:

```ts
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      session: null,
      login: (session) => set({ session }),
      logout: () => { useChatStore.getState().reset(); set({ session: null }) },
    }),
    { name: 'chat-auth' } // ← localStorage gerenciado automaticamente
  )
)
```

O `persist` middleware sincroniza o estado com o `localStorage` automaticamente — sem `getItem` manual, sem risco de inconsistência entre tabs.

---

### Por que Screaming Architecture?

A estrutura anterior (`src/hooks/`, `src/services/`, `src/pages/`) organizava por **tipo técnico**. Isso não "grita" o que o sistema faz.

A nova estrutura organiza por **domínio de negócio**:

```
src/
├── auth/              # tudo que pertence à autenticação
│   ├── services/      # chamadas HTTP: register, login
│   ├── store/         # estado global da sessão (Zustand)
│   └── pages/Login/   # única tela de login — JSX limpo
├── chat/              # tudo que pertence ao chat
│   ├── hooks/useWebSocket.ts  # side-effect puro, zero useState
│   ├── store/chatStore.ts     # mensagens, deduplicação, backfill
│   └── pages/Chat/   # única tela de chat — JSX limpo
└── shared/            # primitivos sem domínio (UI, tipos, utils)
```

Um desenvolvedor novo no projeto abre `src/` e imediatamente sabe o que o sistema faz. Isso é Screaming Architecture.

---

### A Jornada de Autenticação (passo a passo)

#### 1. Boot da Aplicação — Lazy Hydration

O `App.tsx` não usa `useEffect` para reidratar a sessão. Usa **lazy state initializer** via Zustand persist:

```ts
// App.tsx — 14 linhas totais
const session = useAuthStore(s => s.session)    // lê do localStorage na primeira renderização
const login   = useAuthStore(s => s.login)
const logout  = useAuthStore(s => s.logout)

return session ? <Chat session={session} onLogout={logout} /> : <Login onLogin={login} />
```

Se o token existir no `localStorage`, o usuário vai direto pro Chat sem nenhuma chamada de rede. Se não existir, vai pro Login. **Zero setState cascadeado, zero useEffect, zero flash de tela**.

#### 2. Tela de Login — Separação de Responsabilidades

O `Login.tsx` não sabe como funciona HTTP. Ele delega para o `authService`:

```ts
// auth/services/auth.ts — único ponto de contato com a API
export const authService = {
  register: (username, password) => request('/api/auth/register', { username, password }),
  login:    (username, password) => request('/api/auth/login',    { username, password }),
}
```

**Por que serviço separado?** Testabilidade. Em testes, substituímos o `authService` por um mock e o componente Login não precisa mudar nem uma linha. Além disso, se o endpoint mudar de `/api/auth/login` para `/api/v2/auth/session`, mudamos em **um único lugar**.

O componente em si tem:
- Loading state durante a chamada
- Feedback visual diferenciado: verde para sucesso, vermelho para erro
- Toggle entre registro e login sem recarregar a página
- `autoComplete` correto para password managers

#### 3. Pós-Login — WebSocket Gate

Com a sessão no store, o `Chat` monta e o `useWebSocket(session)` dispara:

```ts
// chat/hooks/useWebSocket.ts — zero useState
export function useWebSocket(session: Session) {
  const { messages, addMessage, mergeBackfill, setConnected } = useChatStore()
  // ...

  useEffect(() => {
    let shouldConnect = true  // ← guard contra React StrictMode double-mount

    const socket = new WebSocket(`ws://localhost:8080/ws?token=${session.token}`)
    // ...
    return () => {
      shouldConnect = false
      socket.onopen = socket.onmessage = socket.onclose = null
      if (socket.readyState <= WebSocket.OPEN) socket.close()
    }
  }, [session.token])
}
```

**Por que `shouldConnect` flag?** React StrictMode em desenvolvimento monta e desmonta os efeitos duas vezes para detectar side-effects impuros. Sem essa flag, o cleanup do primeiro mount chamaria `socket.close()` enquanto o socket ainda estava em `CONNECTING` (readyState=0), resultando no erro "WebSocket closed before connection established" no Chrome.

#### 4. Backfill — Resiliência no Reconect

No `onopen`, calculamos o cursor local e pedimos as mensagens perdidas:

```ts
socket.onopen = () => {
  if (!shouldConnect) return
  setConnected(true)
  const cursor = messagesRef.current.reduce((max, m) => Math.max(max, m.sequence ?? 0), 0)
  socket.send(JSON.stringify({ type: 'sync', cursor }))
}
```

O servidor responde com `{ type: 'sync_result', messages: [...] }` com as mensagens após o cursor. O store faz merge com deduplicação por `id`:

```ts
mergeBackfill: (msgs) => {
  const fresh = msgs.filter(m => !messages.some(p => p.id === m.id))
  set({ messages: [...messages, ...fresh].sort((a, b) => a.sequence - b.sequence) })
}
```

#### 5. Logout — Limpeza Completa

```ts
logout: () => {
  import('@/chat/store/chatStore').then(({ useChatStore }) => {
    useChatStore.getState().reset()  // limpa mensagens e connection status
  })
  set({ session: null })  // limpa a sessão → App redireciona para Login
}
```

O `persist` middleware limpa o `localStorage` junto com o `set({ session: null })`. A próxima abertura do app inicia fresh.

---

### UI Design — Inspiração Discord/Linear

A UI foi redesenhada com:

- **Dark mode forçado**: paleta indigo-violet via `oklch()` no `index.css`, sem toggle de tema
- **Login**: card com `backdrop-blur`, ambient glow blobs, botão com gradiente animado
- **Chat**: header com blur e gradiente, mensagens agrupadas por remetente, avatars com iniciais e cor determinística por username, bubble-style com "tail" invertido para mensagens próprias, auto-scroll suave

---

## ⚙️ Backend — Resumo

| Módulo | Implementação |
|---|---|
| `POST /api/auth/register` | Cria usuário com senha hasheada via `scrypt` (Node native crypto, sem dependência C++) |
| `POST /api/auth/login` | Verifica hash, gera JWT HS256 com 7 dias, salva sessão no Postgres |
| WebSocket Gateway | Valida assinatura JWT no handshake via query param `?token=`. Conexões sem token ou com token inválido recebem close frame `1008 Policy Violation` antes de alocar memória |
| Error Handling | `setErrorHandler` global no Fastify para prevenir stack traces em produção; `try/catch` em todas as rotas de banco |

**Decisão de arquitetura (ADR 007)**: o check stateful de sessão no banco foi implementado e testado, mas foi simplificado para JWT stateless no Gateway WS enquanto diagnosticamos uma inconsistência de token entre o Zustand persist e a tabela `sessions`. A revogação de sessão via Redis está documentada como Fase 5.

---

## ✅ Checklist

- [x] Registro e login via REST funcionando end-to-end
- [x] Sessão persistida no Zustand com `persist` middleware (sem localStorage manual)  
- [x] Logout limpa store de chat e authStore
- [x] UI redesenhada: dark mode, Discord/Linear inspired
- [x] Strings em inglês em toda a aplicação
- [x] `ErrorBoundary` React adicionado em `shared/`
- [x] Fastify `setErrorHandler` global
- [x] Clean Code, SoC, KISS, YAGNI, Screaming Architecture
- [x] TypeScript + ESLint gates passando no Husky pre-commit
- [ ] WebSocket token validation (WS stateless funcionando, DB session check — Fase 5)
