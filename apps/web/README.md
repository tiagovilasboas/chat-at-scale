# apps/web

Cliente React do lab (Vite + React Compiler). É um **nó** do sistema: cookie HttpOnly via proxy, backfill por `sequence` no `onopen`, dedup por id.

Start, honestidade do MVP e a trilha de design: [README na raiz](../../README.md).

```bash
# from repo root
npm run dev:web
```

Local: o Vite faz proxy de `/api` e `/ws` para `localhost:8080`. `VITE_API_URL` / `VITE_WS_URL` no `.env.example` não são lidos pelo cliente atual.
