# 06 — Considerações de Escalabilidade

> Padrões de carga, gargalos e estratégias de escala para a plataforma de mensagens.

---

## 1. Tipos de carga

### 1.1 1:1 (DM : Mensagem Direta)

| Dimensão | Característica | Impacto de escala |
|----------|----------------|-------------------|
| **Participantes** | 2 por conversa | Fan-out = 1; custo de broadcast mínimo |
| **Conexões** | 2 conexões WebSocket envolvidas | Custo baixo por mensagem |
| **Taxa de mensagens** | Variável; muitas vezes em burst (typing, send) | Throughput agregado baixo |
| **Conversas quentes** | Poucas; maioria ociosa | Maior tráfego distribuído entre muitas convs |

**Gargalo:** Improvável. Fan-out de 1 é trivial. Contagem de conexões e taxa de escrita de persistência são os limites.

### 1.2 Grupos pequenos (3–20 participantes)

| Dimensão | Característica | Impacto de escala |
|----------|----------------|-------------------|
| **Participantes** | 3–20 por conversa | Fan-out = 3–20; custo de broadcast moderado |
| **Conexões** | Até 20 por mensagem (muitos podem estar offline) | Cada mensagem dispara N pushes |
| **Taxa de mensagens** | Moderada; padrões de discussão | Throughput escala com contagem de grupos |
| **Membership** | Pequeno; barato de resolver | Overhead baixo |

**Gargalo:** Custo de fan-out cresce linearmente. A 1k msg/s em 100 grupos ativos (média 10 participantes), empurramos ~10k mensagens/s. Gateway e broker lidam com isso.

### 1.3 Canais grandes (10s–100s de participantes)

| Dimensão | Característica | Impacto de escala |
|----------|----------------|-------------------|
| **Participantes** | 20–500+ por canal | Fan-out = 20–500; custo de broadcast alto |
| **Conexões** | Muitos participantes frequentemente online | Uma mensagem → centenas de pushes |
| **Taxa de mensagens** | Pode ser muito alta (eventos ao vivo, anúncios) | Burst de 100 msg/s × 200 destinatários = 20k pushes/s |
| **Membership** | Grande; resolução e cache de membership importam | Deve fazer cache; leituras de DB são caras |

**Gargalo:** Fan-out domina. Um canal quente com 200 usuários online e 50 msg/s = 10k pushes/s só desse canal.

### 1.4 Resumo do perfil de carga

| Tipo | Fan-out | Custo principal | Em risco quando |
|------|---------|-----------------|-----------------|
| 1:1 | 1 | Persistência, conexões | Muitos DMs concorrentes |
| Grupo pequeno | 3–20 | Fan-out, membership | Muitos grupos ativos |
| Canal grande | 20–500+ | Fan-out, membership | Canal quente, tráfego em burst |

---

## 2. O problema do fan-out

### 2.1 O que é fan-out?

Uma mensagem enviada para uma conversa deve chegar a N participantes. Para cada participante:
- Se **online:** push via WebSocket.
- Se **offline:** mensagem armazenada; entregue ao reconectar via backfill.

**Custo de fan-out** = trabalho para entregar uma mensagem a N destinatários. Cresce com N.

### 2.2 Dimensões do fan-out

| Dimensão | Custo | Notas |
|----------|-------|-------|
| **Resolver membership** | O(N) ou O(1) com cache | Quem está na conversa? |
| **Filtrar online** | O(N) ou O(1) com índice | Quais dos N estão conectados? |
| **Push para cada** | O(online_count) | Uma escrita por destinatário conectado |
| **Persistir uma vez** | O(1) | Uma escrita no DB por mensagem |
| **Roteamento entre nós** | O(online_count) | Se destinatários em Gateways diferentes |

### 2.3 Estratégias de fan-out

| Estratégia | Como | Prós | Contras |
|------------|------|------|---------|
| **Iterar e empurrar** | Para cada participante online, empurrar | Simples | O(N) por mensagem; bloqueia em escritas lentas |
| **Publicar no broker** | Publicar uma vez; N assinantes consomem | Desacopla; durável | Latência do broker; precisa tópico por conversa ou usuário |
| **Push em batch** | Agrupar destinatários por Gateway; batch | Menos mensagens no broker | Mais complexo |
| **Lazy fan-out** | Armazenar primeiro; job assíncrono faz fan-out | Persistir rápido; fan-out assíncrono | Maior latência para destinatários |

### 2.4 Abordagem escolhida (da arquitetura)

- **MVP:** Iterar e empurrar in-memory. Gateways co-localizados com Messaging. O(online_count) escritas.
- **Escala:** Message broker. Messaging publica por conversa ou por usuário; Gateways se inscrevem. Desacopla; permite fan-out entre nós.

### 2.5 Matemática do fan-out (ilustrativa)

Para sistema de 1k msg/s em geral, com mix:
- 50% 1:1 (fan-out 1): 500 × 1 = 500 pushes/s
- 30% grupos pequenos (média 10): 300 × 10 = 3k pushes/s
- 20% canais (média 100 online): 200 × 100 = 20k pushes/s

**Total: ~23,5k pushes/s.** Gateway e broker devem sustentar isso. Canais grandes dominam.

---

## 3. Gargalos

### 3.1 Gateway: contagem de conexões

| Gargalo | Limite | Causa |
|---------|--------|-------|
| **Conexões por processo** | ~10k–50k (SO e memória) | Cada WebSocket = file descriptor + buffer |
| **Conexões por nó** | Similar | Processo único ou poucos processos por nó |

**Mitigação:** Escala horizontal. Mais instâncias de Gateway = mais conexões. Load balancer + sticky sessions.

### 3.2 Gateway: throughput de push

| Gargalo | Limite | Causa |
|---------|--------|-------|
| **Escritas de saída/s** | CPU e rede | Cada push = serializar + escrever no socket |
| **Back-pressure** | Clientes lentos bloqueiam | Um cliente lento pode travar uma conexão |

**Mitigação:** Escritas assíncronas; back-pressure por conexão; fechar ou limitar clientes muito lentos.

### 3.3 Messaging: atribuição de sequence

| Gargalo | Limite | Causa |
|---------|--------|-------|
| **Um escritor por conversa** | Atribuição de sequence é serializada | Ordem total requer um escritor |
| **Lock do DB ou tabela de sequence** | Contenção em conversas quentes | Muitas mensagens para mesma conversa |

**Mitigação:** Particionar por conversation_id. Cada conversa tem um shard; conversas são independentes. Conversa quente = shard quente, mas outras conversas não afetadas.

### 3.4 Persistência: taxa de escrita

| Gargalo | Limite | Causa |
|---------|--------|-------|
| **Escritas/s** | Depende do DB (ex.: 1k–10k/s para Postgres) | Write-through = cada mensagem = uma escrita |
| **Connection pool** | Esgotamento sob carga | Muitas escritas concorrentes |

**Mitigação:** Shard de mensagens por conversation_id. Usar store time-series ou append-only. Connection pooling.

### 3.5 Persistência: taxa de leitura (membership, backfill)

| Gargalo | Limite | Causa |
|---------|--------|-------|
| **Lookups de membership** | Toda mensagem precisa de membership | O(1) com cache; O(N) sem |
| **Queries de backfill** | Reconnects disparam leituras | Baseado em cursor; indexado por (conversation_id, sequence) |

**Mitigação:** Cache de membership; invalidar em join/leave. Índice para backfill: `(conversation_id, sequence)`.

### 3.6 Fan-out: roteamento entre nós

| Gargalo | Limite | Causa |
|---------|--------|-------|
| **Throughput do broker** | Mensagens/s | Pub/sub tem limites por tópico ou globalmente |
| **Descoberta do Gateway** | Qual Gateway tem usuário X? | Precisa mapeamento: user_id → Gateway |

**Mitigação:** Sticky sessions; session store (Redis) mapeia user_id → instância do Gateway. Brokers (Kafka, Redis Streams, etc.) escalam com partições.

### 3.7 Resumo: hierarquia de gargalos

| Prioridade | Gargalo | Aparece primeiro em | Mitigação |
|------------|---------|---------------------|-----------|
| 1 | Fan-out (canais grandes) | ~100 participantes, alta taxa msg | Broker; particionar por conversa |
| 2 | Conexões no Gateway | ~10k conexões | Escala horizontal do Gateway |
| 3 | Escritas na persistência | ~1k msg/s | Sharding; store otimizado para escrita |
| 4 | Resolução de membership | Fan-out alto | Cache de membership |
| 5 | Contenção de sequence | Uma conversa quente | Sharding por conversa (natural) |

---

## 4. Estratégias para escalar

### 4.1 Escala horizontal

| Componente | Como | Quando |
|------------|------|--------|
| **Gateway** | Adicionar mais instâncias de Gateway; LB distribui conexões | Contagem de conexões ou throughput de push |
| **Messaging** | Adicionar mais instâncias de Messaging; broker distribui trabalho | Latência de processamento; nó único saturado |
| **Persistência** | Read replicas para backfill/membership; write primary | Leitura pesada; tempestades de backfill |

**Restrição:** Gateway é stateful (conexões). Sticky sessions ou session store para Messaging rotear ao Gateway correto.

### 4.2 Particionamento

| Dimensão | Particionar por | Efeito |
|----------|-----------------|--------|
| **Conversas** | conversation_id | Mensagens e sequence por conversa são independentes. Shard de tabela de mensagens por conversation_id. |
| **Usuários** | user_id | Gateways podem ser particionados por usuário; ou tópicos de assinatura por user_id. |
| **Tempo** | timestamp | Para storage de mensagens: particionar por tempo para retenção e arquivamento. |

**Chave:** Particionamento por conversation_id é natural. Uma conversa = uma partição = um sequencer. Sem coordenação entre partições para ordenação.

### 4.3 Caching

| Cache | O quê | Invalidação | Efeito |
|-------|------|-------------|--------|
| **Membership** | conversation_id → [user_ids] | Em join, leave | Evitar leitura de DB por mensagem; crítico para fan-out |
| **Localização de sessão** | user_id → instância do Gateway | Em connect, disconnect | Rotear fan-out ao Gateway correto |
| **Backfill** | (conv, cursor) → messages | TTL ou evitar | Raro; backfill é geralmente pontual |

**Cache de membership:** Maior impacto. Toda mensagem precisa de membership; cache reduz carga no DB em ordens de magnitude.

### 4.4 Message broker

| Papel | Como | Quando |
|-------|------|--------|
| **Desacoplar Messaging e Gateway** | Messaging publica; Gateways assinam | Implantação multi-nó |
| **Durabilidade** | Brokers persistem; sobrevivem a restarts | Tolerância a falhas |
| **Particionamento** | Tópicos/partições por conversa ou usuário | Paralelismo |

**Opções de design de tópico:**
- Tópico por usuário: cada usuário assina seu próprio tópico. Fan-out publica N vezes (uma por usuário). Simples mas N publicações.
- Tópico por conversa: cada conversa tem tópico. Gateway assina tópicos de conversas que seus usuários conectados cuidam. Menos publicações; gerenciamento de assinatura mais complexo.

**Recomendação:** Tópico por usuário ou por conversa com Gateway assinando por seus usuários. Depende do broker e padrão de fan-out.

### 4.5 Gerenciamento de conexão e sessão

| Estratégia | Como | Trade-off |
|------------|------|-----------|
| **Sticky sessions** | LB roteia mesmo cliente ao mesmo Gateway | Simples; falha do Gateway perde conexões |
| **Session store (Redis)** | user_id → Gateway_id; Messaging consulta antes de push | Permite roteamento; latência extra e dependência |
| **Pub/sub para todos Gateways** | Todo Gateway recebe toda mensagem; cada um filtra para suas conexões | Simples; desperdiça; só para escala pequena |
| **Subscribe particionado** | Gateways assinam apenas mensagens para usuários que detêm | Eficiente; requer chave de partição (user_id) |

**Em escala:** Session store + subscribe particionado. Messaging publica com user_id; apenas Gateway que tem aquele usuário recebe.

### 4.6 Escala da persistência

| Estratégia | Como | Quando |
|------------|------|--------|
| **Sharding por conversation_id** | Partição hash ou range | Taxa de escrita excede DB único |
| **Read replicas** | Backfill e leituras de membership da réplica | Leitura pesada; tempestades de backfill |
| **Store time-series** | Append-only; otimizado para scans (conv, sequence) | Alta taxa de escrita; volume de mensagens |
| **Cold storage** | Mensagens antigas para S3/archive; quentes no DB | Retenção; custo |

### 4.7 Degradação sob carga

| Carga | Comportamento | Objetivo |
|-------|---------------|----------|
| **Na capacidade** | Latência aumenta; back-pressure para clientes | Sem drop silencioso; enfileirar ou rejeitar com erro |
| **Acima da capacidade** | Rejeitar novas conexões ou novos envios com 503 | Degradação graciosa; cliente retenta |
| **Persistência lenta** | Remetente vê latência; sem ack até persistir | INV-007; sem ack antes de persistir |
| **Fan-out lento** | Destinatários veem atraso; backfill alcança | At-least-once; entrega eventual |

---

## 5. Roadmap de escala

| Fase | Conexões | Msg/s | Topologia | Mudanças principais |
|------|----------|------|----------|---------------------|
| **MVP** | 100–500 | &lt;100 | Nó único | Fan-out in-memory; DB único |
| **Escala inicial** | 1k–5k | 100–500 | Gateway ×2–5; Messaging único | Sticky sessions; cache de membership |
| **Escala média** | 5k–20k | 500–1k | Gateway ×5–10; Messaging ×2; broker | Message broker; session store |
| **Grande escala** | 20k–50k | 1k–2k | Multi-nó completo; DB shardado | Particionamento; read replicas |

---

## 6. Documentos relacionados

- [01 — Definição do Problema](./01-problem-definition.md)
- [04 — Arquitetura](./04-architecture.md)
- [05 — Modelo de Mensagens](./05-messaging-model.md)
