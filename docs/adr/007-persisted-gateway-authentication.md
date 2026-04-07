# ADR 007: Persisted Gateway Authentication & Session Modeling

## Status
Aceito

## Contexto
O design primário da Camada de Segurança exigia proteção "Zero-Trust" contra Sockets não autorizados na URL (`ws://`). Entretanto, arquiteturas state-of-the-art recusam a utilização de JWT puramente "Stateless" distribuído, dado o infame "Problema da Revogação": se um token é roubado, o Gateway aceitará o intruso até a expiração matemática do JWT no corpo criptográfico. Num app de Chat massivo, precisamos da capacidade atômica de "Derrubar" contas hackeadas instantaneamente.

## Decisão Técnica
Migramos para o padrão de **Bifurcação de Estado (Persisted Sessions)**:
1. **Schema Refactoring (Drizzle)**: O banco PostgreSQL recebe a camada `sessions`, rastreando UUIDs por *device*, datas de expiração e colunas *Revoked*. A tabela `users` foi blindada com obrigatoriedade de senhas, sepultando o auto-registro "anônimo".
2. **Ciclo Assíncrono HTTP-to-WebSocket**:
   * O cliente retransmite REST `POST /api/auth/register` ou `login`. O Fastify computa hashes, registra no PG `sessions` e emite o JWT contendo exclusivamente a chave `{ sessionId, userId }`.
   * O envio do Upgrade via `ws://...?token=XYZ` força o Gateway a abrir o JWT e checar **sua contraparte no banco de dados**. Se a Sessão foi purgada ou o usuário banido (tabela off), emitimos o sinal `1008 Policy Violation`, abortando o Buffer da memória nativa.

## Consequências
* **Positivas**: Evita JWTs assombrados. Permite rastreio investigativo forense (Data Ops) para monitorar múltiplas instâncias web abertas por um mesmo id.
* **Complexidade (Trade-off de Performance)**: Existirá um acréscimo direto de I/O Read Queries no Banco para *cada nova tentativa de conexão*. Num cenário de C10K agressivo, isso eleva a carga de CPU do Postgres. O racional Staff julga esse atrito necessário em prol da invulnerabilidade, com vias abertas para delegar a leitura do `sessions` a um cluster de `Redis` atômico via Memcached no longo prazo, se o índice estourar latências P95.
