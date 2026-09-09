# ADR 006: Adiamento da Autenticação e Priorização do Backfill (YAGNI)

## Status
Aceito (histórico). Auth no gateway chegou na Fase 4: ver [ADR 007](./007-persisted-gateway-authentication.md). Este registro explica *por que* a Fase 2 priorizou backfill.

## Contexto
Durante a Fase 2 (Core Business Rules), o planejamento inicial previa a implementação do Módulo de Autenticação (JWT + Gatekeeper no WebSocket) para proteção. Entretanto, sob a luz de preceitos mapeados no `CLAUDE.md` (KISS e YAGNI), inferiu-se que injetar controle de acesso neste momento traria atrito mecânico prematuro enquanto a estabilidade da própria mensageria no front-end não fosse blindada. 

O risco estrutural primário arquitetônico no "Chat at Scale" não é lidar com *quem envia* neste instante inicial, mas sim *como re-adquirir os frames perdidos de comunicação* em uma queda massiva de rede 3G/4G para 10 mil conexões simuladas sem destruir a ordem cronológica do banco (Sequence Database Invariant).

## Decisão Técnica
Foi decidido em acordo **adiar (defer) a camada de Gatekeeper (Auth)** e focar 100% no motor de **Resiliência e Recuperação (Sincronização / Backfill)**.
* O client front-end assumirá credenciais simuladas (`userId` hash aleatório dinâmico) permitindo contornar a assinatura das rotas do Fastify.
* A infraestrutura do gateway consumirá esse esforço para responder a chamadas assíncronas do tipo `{type: "sync"}`, onde o frontend React, logo exposto no `onopen()`, calculará o maior Sequence renderizado na UI e exigirá ao servidor Drizzle ORM apenas o `offset` do que ele desconhece. 

## Consequências
*   **Positivas**: Evitamos Overengineering severo nas rodadas iniciais. Comprovamos o funil vital da hidratação com queries em Drizzle otimizadas (usando a constraint `gt` > `cursor`).
*   **Evolução (ocorrida)**: Fase 4 fechou o upgrade `/ws` com JWT em cookie HttpOnly, não Bearer na query. Ver [ADR 007](./007-persisted-gateway-authentication.md). Membership e `revoked_at` no handshake continuam em aberto.
