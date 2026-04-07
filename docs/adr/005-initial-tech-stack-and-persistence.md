# ADR 0001: Definição da Stack Inicial e Arquitetura MVP

## Status
Aceito

## Contexto
O projeto "Chat at Scale" exige uma arquitetura orientada a alta escalabilidade (10k-50k conexões simultâneas) e ausência de perda silenciosa de mensagens, mantendo a ordem estrita (monotônica). Para a fase de MVP (Nó Único), necessitamos de um stack que não nos gere *lock-in* no futuro, prezando pelas boas práticas (KISS, YAGNI, SoC, Clean Arch Minimalista).

## Decisão Técnica
Após revisão das regras e requisitos, as seguintes tecnologias e filosofias foram adotadas:

1. **Backend**: Node.js com TypeScript e **Fastify**. O Node.js possui um *Event Loop* não bloqueante capaz de segurar dezenas de milhares de conexões de WebSockets ativas a um baixo custo de recursos físicos.
2. **Persistence & ORM**: **Drizzle ORM** com PostgreSQL. Pela necessidade explícita no DOC 04 de utilizarmos o padrão *write-through* com `sequences` atômicos criados na persistência, escolhemos o Drizzle pela sua abordagem lightweight (sem sobrecargas de memory footprint) e extrema união ao SQL puro, mantendo a tipagem estrita (type-safety).
3. **Frontend Cliente**: React + Vite configurados com o **React Compiler**. Aplicações de tempo real como um Chat lidam com a mutação violenta de longas listas de DOM. O uso do compiler nativo do React anula os clássicos problemas causados por falta de `useMemo` manual ou *re-renders* massivos.
4. **UI Architecture**: TailwindCSS v4 acoplado ao **Shadcn UI**, adotando uma estrutura espelhada no *react-vite-boilerplate* para manter a coesão corporativa (`app/`, `features/`, `pages/`).
5. **Padrão Arquitetural Node**: Minimal Clean Architecture. Isolamento do framework (`infrastructure/websocket/handler`), das regras de negócio atômicas (`application/use-cases/`) e tipagens do núcleo puro (`domain`). 

## Consequências
*   **Positivas**: Throughput altíssimo no I/O garantindo o P99 < 500ms; Facilidade para extrair o `Gateway` do `Messaging` em micro-serviços no futuro e acoplar um *Broker* para viabilizar escala horizontal sem mexer nos arquivos do domínio.
*   **Naturais/Alertas**: Utilizar WebSockets "nus" ao invés de pacotes stateful muito abstratos (ex: Socket.io) aumenta levemente o trabalho para gestão de reconexão automática, mas assegura controle total do funil do sistema em escala.
