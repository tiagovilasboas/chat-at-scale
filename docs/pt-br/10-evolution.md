# 10 - Evolução em Produção

> Como este sistema evoluiria quando implantado em ambiente de produção real: o que muda, o que quebra primeiro e o que exige redesenho.

**Staff/Principal:** Pense no que quebra primeiro antes de acontecer. Evolução não é improviso, é planejar pontos de corte e migração desde o dia um.

---

## 1. Fases de evolução

### Fase 0: MVP (dia um)

| Estado | Topologia | Características |
|--------|-----------|-----------------|
| Nó único | Gateway + Messaging combinados; DB único | Fan-out in-memory; sem broker; disponibilidade best-effort |
| Escala | 100–500 conexões; &lt;100 msg/s | Valida design; sem redundância |

**Funciona até:** Um canal quente, pico de conexões ou ponto único de falha.

---

### Fase 1: Escala inicial (primeiras dores de crescimento)

**Gatilho:** 1k–5k conexões; algumas centenas de msg/s; primeira conversa "quente".

| O que muda | Antes | Depois |
|------------|-------|--------|
| Gateway | Processo único | 2–5 instâncias; load balancer; sticky sessions |
| Membership | Leitura do DB por mensagem | Cache (Redis ou in-process); invalidar em join/leave |
| Observabilidade | Logs básicos | Métricas (latência, throughput); dashboards |
| Deploy | Deploy único | Rolling deploys; health checks |

**O que quebra primeiro:**
- **Teto de conexões** : Processo único atinge ~10k conexões; novas conexões falham ou ficam lentas.
- **DB de membership sob carga** : Toda mensagem = lookup de membership; DB vira gargalo.
- **Um canal quente** : 50 usuários ativos, 20 msg/s = 1k pushes/s de uma conversa; fan-out in-memory começa a atrasar.

**Sem redesenho ainda.** Gateway horizontal + cache de membership resolve.

---

### Fase 2: Escala média (mudança arquitetural)

**Gatilho:** 5k–20k conexões; 500–1k msg/s; múltiplos Gateways; um nó não consegue segurar todas conexões ou processar todo fan-out.

| O que muda | Antes | Depois |
|------------|-------|--------|
| Fan-out | In-memory; Gateway co-localizado com Messaging | Message broker (Kafka, Redis Streams); Messaging publica; Gateways assinam |
| Sessão | Sticky pelo LB; Messaging "sabe" Gateway local | Session store: user_id → instância do Gateway; Messaging roteia via broker |
| Messaging | Processo único | 2+ instâncias; broker distribui trabalho |
| Deploy | Região única | Mesmo; mas multi-nó |

**O que quebra primeiro:**
- **Fan-out entre nós** : Destinatários no Gateway A; mensagem do remetente processada em nó com Gateway B. Push in-memory falha para usuários de A. Precisa broker para qualquer Messaging publicar e qualquer Gateway consumir.
- **Descoberta do Gateway** : "Qual Gateway tem usuário X?" Sem resposta sem session store. Fan-out não consegue rotear.
- **Gargalo do Messaging único** : Persist + fan-out em um processo; CPU saturada. Precisa mais instâncias de Messaging; broker particiona por conversa.

**Redesenho:** Caminho de fan-out. Iteração in-memory substituída por publicar-no-broker. Esta é a maior mudança arquitetural. Protocolo (formato de mensagem, ack, backfill) permanece; infraestrutura muda.

---

### Fase 3: Grande escala (dados e infra)

**Gatilho:** 20k–50k conexões; 1k–2k msg/s; taxa de escrita na Persistência; tempestades de backfill.

| O que muda | Antes | Depois |
|------------|-------|--------|
| Persistência | DB único | Shardado por conversation_id; ou store time-series |
| Backfill | DB primary | Read replicas; ou ler de réplica com tolerância a lag |
| Canais quentes | Mesmo tratamento | Possivelmente rate limit; ou lazy fan-out; ou entrega em camadas |
| Geográfico | Região única | Possivelmente multi-região para latência |
| Operações | Escala manual | Auto-scaling; alertas baseados em SLO |

**O que quebra primeiro:**
- **Taxa de escrita na persistência** : 2k msg/s = 2k escritas/s. Postgres único pode sofrer. Connection pool esgotado. Precisa sharding ou store otimizado para escrita.
- **Tempestade de backfill** : Restarts do Gateway; 10k clientes reconectam; 10k requisições de backfill em segundos. DB primary sobrecarregado. Precisa read replicas ou backfill de cache.
- **Canal quente** : Um canal com 500 online, 100 msg/s = 50k pushes/s. Broker e Gateways podem não acompanhar. Precisa estratégia diferente: rate limit, sampling ou tier "canal ao vivo".

**Redesenho:** Topologia da persistência. DB único → shardado ou store especializado. Schema pode precisar suportar particionamento desde o início (conversation_id na partition key).

---

### Fase 4: Além do design inicial

**Gatilho:** 100k+ conexões; multi-região; canais muito grandes (1k+ participantes); funcionalidades fora do escopo (presence, push, mídia).

| O que muda | Escopo |
|------------|--------|
| Multi-região | Usuários na EU, US; latência; replicação; roteamento |
| Canais muito grandes | Fan-out para 1k+; possivelmente produto diferente (read-only? sampled?) |
| Push notifications | Mobile; FCM/APNs; caminho de entrega diferente |
| Mídia | Storage; CDN; tipos de mensagem |
| Presence | Online/offline; last seen; mais estado |

**O que quebra primeiro:**
- **Premissa de região única** : Todos usuários atingem uma região. Usuários distantes têm alta latência. Lag de replicação entre regiões; questões de consistência.
- **Fan-out linear em N** : 1k participantes = 1k pushes por mensagem. Não escala. Precisa lazy fan-out ou modelo fundamentalmente diferente (ex.: pull para canais grandes).
- **Cliente stateless** : Uma conexão por usuário. Multi-dispositivo = múltiplas conexões; precisa definir semântica.

**Redesenho:** Arquitetura multi-região; decisões de produto para canais grandes; pipeline de push; pipeline de mídia. Isso vai além do design atual.

---

## 2. O que quebra primeiro (resumo)

| Ordem | Componente | Sintoma | Limiar aproximado |
|-------|------------|---------|---------------------|
| 1 | **Conexões do Gateway** | Novas conexões falham ou dão timeout | ~10k conexões por processo |
| 2 | **Lookups de membership** | DB sobrecarregado; persist lento | ~500 msg/s sem cache |
| 3 | **Fan-out in-memory** | Pico de latência; push lento | ~100 destinatários, ~50 msg/s |
| 4 | **Roteamento entre nós** | Destinatários em outro Gateway não recebem push | Primeira implantação multi-Gateway |
| 5 | **Escritas na persistência** | Connection pool cheio; timeouts de persist | ~1k–2k msg/s |
| 6 | **Backfill** | DB sobrecarregado em tempestade de reconnect | Reconnect em massa (100s–1000s) |
| 7 | **Canal quente** | Um canal satura o sistema | 200+ online, 50+ msg/s |

---

## 3. O que precisaria de redesenho

### 3.1 Modelo de fan-out

**Atual:** Iterar e empurrar síncrono (MVP) ou publicar no broker (escala). Uma mensagem → N pushes.

**Redesenho quando:** N é muito grande (500+ online). Push por destinatário não escala.

**Opções:**
- **Lazy fan-out:** Persistir primeiro; job assíncrono faz fan-out. Maior latência para destinatários.
- **Pull para canais grandes:** Não empurrar; cliente faz poll ou long-poll. Produto diferente.
- **Entrega em camadas:** Pequenos grupos recebem push; canais grandes recebem batch ou sampled.
- **Read replica para histórico:** Canal grande = maior leitura; otimizar backfill; tempo real apenas para "recente".

### 3.2 Modelo de persistência

**Atual:** DB único; ou shardado por conversation_id. Write-through; uma escrita por mensagem.

**Redesenho quando:** Taxa de escrita excede capacidade do DB shardado; ou retenção/custo exige storage diferente.

**Opções:**
- **Store time-series:** Append-only; otimizado para scans (conversation_id, sequence). Ex.: TimescaleDB, InfluxDB.
- **Cold storage:** Mensagens antigas para S3/archive; quentes no DB. Backfill de archive para mensagens antigas; caminho de código diferente.
- **Event sourcing:** Armazenar eventos; derivar mensagens. Permite replay, auditoria; mais complexo.

### 3.3 Sessão e roteamento

**Atual:** Session store mapeia user_id → Gateway. Broker roteia por usuário.

**Redesenho quando:** Multi-região. Usuário na EU conecta ao Gateway EU; mensagem enviada dos US. Roteamento deve ser cross-region.

**Opções:**
- **Session store global:** user_id → (região, gateway_id). Fan-out publica no broker global; Gateways regionais consomem para sua região.
- **Broker por região:** Mensagem replicada para regiões; cada região faz fan-out para conexões locais. Lag de replicação; entrega eventual.

### 3.4 Multi-dispositivo

**Atual:** Uma conexão por usuário (implícito). Um dispositivo.

**Redesenho quando:** Usuário no celular e laptop. Ambos devem receber mensagens. Ambos podem enviar. Dedup, ordenação, semântica de cursor mudam.

**Opções:**
- **Conexão por dispositivo:** Cada dispositivo tem conexão; fan-out inclui todos. Dedup por dispositivo. Servidor rastreia last-delivered por (usuário, dispositivo, conversa) para cursor.
- **Cursor independente do dispositivo:** Servidor rastreia por usuário; backfill retorna o que usuário não viu em nenhum dispositivo. Mais estado.

### 3.5 Idempotency store

**Atual:** In-memory ou Redis; TTL 24h. idempotency_key → (message_id, sequence).

**Redesenho quando:** Múltiplas instâncias de Messaging; ou alto volume. Precisa verificação de idempotência distribuída.

**Opções:**
- **Redis com chave:** idempotency_key como chave; valor = message_id. Atômico; compartilhado entre instâncias.
- **Tabela no DB:** idempotency_keys (key, message_id, created_at). Constraint único. Sobrevive a restarts; escala com DB.

---

## 4. O que NÃO precisa de redesenho

| Aspecto | Motivo |
|---------|--------|
| **Formato de mensagem** | message_id, sequence, conversation_id, content : estável |
| **Protocolo** | Send, ack, backfill, push : mesma semântica em escala |
| **Modelo de ordenação** | Ordem total por conversa; sequence do servidor : escala com particionamento |
| **Garantia de entrega** | At-least-once; dedup no cliente : inalterado |
| **Responsabilidades do cliente** | Reconnect, backfill, dedup, UI otimista : inalteradas |
| **Invariantes** | INV-001 a INV-014 : válidos em toda fase |

O contrato central (identidade da mensagem, sequence, cursor, backfill) é projetado para escalar. Evolução está na infraestrutura (broker, sharding, session store), não no protocolo.

---

## 5. Caminhos de migração (sem big bang)

| Mudança | Estratégia de migração |
|---------|------------------------|
| Gateway ×2 | Adicionar instância; LB roteia novas conexões; drenar antiga |
| Cache de membership | Adicionar cache; read-through; DB como fallback; depois write-through em join/leave |
| Message broker | Rodar broker; Messaging publica *e* faz in-memory para mesmo-nó; remover in-memory quando todos Gateways usam broker |
| Session store | Adicionar store; Messaging verifica store primeiro; fallback "apenas local" se miss; depois exigir store |
| Sharding da persistência | Adicionar shards; novas conversas vão para novos shards; migrar antigas (ou dual-write depois cutover) |
| Read replicas | Adicionar réplica; backfill lê da réplica; primary para escritas; monitorar lag |

Cada passo é incremental. Sem redesenho "para o mundo inteiro".

---

## 6. Resumo de riscos

| Risco | Fase | Mitigação |
|-------|------|-----------|
| Falha de nó único | 0–1 | Adicionar redundância de Gateway cedo |
| DB vira gargalo | 1-2 | Cache; depois shard |
| Fan-out não cruza nós | 2 | Broker; session store |
| Tempestade de backfill | 2–3 | Read replicas; jitter no cliente; rate limit |
| Canal quente | 2–4 | Rate limit; ou mudança de produto para canais grandes |
| Multi-região | 4 | Projetar quando necessário; não antes |

---

## Documentos relacionados

- [01 - Definição do Problema](./01-problem-definition.md)
- [04 - Arquitetura](./04-architecture.md)
- [06 - Escalabilidade](./06-scalability.md)
