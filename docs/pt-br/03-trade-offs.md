# 03 — Trade-offs

> Decisões arquiteturais envolvem **trade-offs explícitos**. Este documento lista escolhas principais, opções e justificativas.

**ADRs formais:** [001 WebSocket](../adr/001-websocket-primario.md) · [002 at-least-once](../adr/002-at-least-once.md) · [003 ordem total](../adr/003-ordem-total-por-conversa.md) · [004 write-through](../adr/004-persistencia-write-through.md)

---

## 1. Comunicação em tempo real: WebSocket vs polling

### Opções

| Opção | Como funciona | Prós | Contras |
|-------|---------------|------|---------|
| **WebSocket** | Conexão bidirecional, persistente; servidor empurra quando mensagens chegam | Baixa latência; eficiente (sem requisições repetidas); bidirecional | Gerenciamento de conexão mais complexo; problemas com firewall/proxy; sem reconexão nativa |
| **Short polling** | Cliente requisições em intervalos fixos (ex.: a cada 2s) | Simples; funciona em todo lugar; stateless | Alta latência; desperdício quando idle; mais carga em escala |
| **Long polling** | Cliente requisições; servidor segura até dados ou timeout | Melhor que short polling; menos requisições | Ainda overhead de uma requisição por mensagem; churn de conexão |
| **Server-Sent Events (SSE)** | Stream servidor→cliente unidirecional sobre HTTP | Mais simples que WebSocket; auto-reconnect no browser | Apenas unidirecional; precisa canal separado para envio |

### Decisão: **WebSocket primário**

### Justificativa

- **Latência:** Entrega subsegundo (P99 < 500ms) requer push, não polling. Polling adiciona pelo menos um intervalo de atraso.
- **Eficiência:** Em escala (10k+ conexões), polling multiplica overhead HTTP. WebSocket amortiza custo de conexão.
- **Alinhamento invariante:** INV-010 (latência limitada) e metas de UX em tempo real favorecem WebSocket.
- **Caminho MVP→escala:** WebSocket funciona para MVP (nó único) e escala (múltiplos nós + sticky sessions ou pub/sub compartilhado).

Não adicionamos fallback de long-polling no MVP. Aumenta complexidade (dois caminhos de código, testes) por benefício marginal. Se WebSocket for bloqueado (proxies corporativos raros), revisitamos fallback como melhoria futura.

---

## 2. Garantias de entrega: at-most-once, at-least-once, exactly-once

### Opções

| Garantia | Semântica | Prós | Contras |
|----------|-----------|------|---------|
| **At-most-once** | Envia uma vez; sem retry em falha | Mais simples; menor latência | Mensagens podem ser perdidas; inaceitável para chat |
| **At-least-once** | Retry até entregar; duplicatas possíveis | Sem perda silenciosa; mais simples que exactly-once | Cliente deve deduplicar; pode ver duplicatas |
| **Exactly-once** | Cada mensagem entregue exatamente uma vez | Sem duplicatas; semântica limpa | Complexo: dedup store, idempotência, coordenação |

### Decisão: **At-least-once**

### Justificativa

- **Alinhamento invariante:** INV-005 (at-least-once) e INV-004 (sem drop silencioso) exigem at-least-once como mínimo. At-most-once viola ambos.
- **Custo exactly-once:** Exactly-once exige: (a) dedup store (ex.: por message ID), (b) entrega idempotente, (c) retries coordenados no fan-out. Para chat, exibição duplicada é aceitável; perda não é.
- **Deduplicação no cliente:** Com INV-003 (IDs únicos imutáveis), o cliente deduplica por ID. Simples e bem entendido.
- **Opção futura:** Podemos evoluir para exactly-once depois adicionando dedup server-side antes do fan-out. At-least-once não bloqueia isso.

---

## 3. Modelo de consistência

### Opções

| Modelo | Semântica | Prós | Contras |
|--------|-----------|------|---------|
| **Eventual** | Todos participantes convergem com o tempo; ordem pode diferir | Mais simples; alta disponibilidade | Quebra threading; UX confusa |
| **Causal** | Mensagens relacionadas em ordem causal; sem ordem total garantida | Preserva "happened-before" | Participantes diferentes podem ver ordens totais diferentes |
| **Linearizável / ordem total** | Ordem global única; todos veem mesma sequência | UX clara; replies sempre fazem sentido | Requer coordenação (single sequencer ou consenso) |
| **Ordem por remetente** | Mensagens de cada remetente ordenadas; entre remetentes indefinido | Coordenação mais fraca | Ambíguo em grupo de chat |

### Decisão: **Ordem total por conversa**

### Justificativa

- **Alinhamento invariante:** INV-008 exige que todo participante observe mesma ordem total em uma conversa.
- **UX:** Threads de chat e replies requerem ordem única compartilhada. Ordem causal permite A ver M1→M2 enquanto B vê M2→M1, que quebra replies.
- **Implementação:** Servidor atribui número de sequence monotônico por conversa. Um escritor (ou shard por conversa) evita consenso distribuído por mensagem no caso comum.
- **Custo:** Single sequencer por conversa é aceitável; conversas são independentes, então escalamos adicionando conversas, não relaxando ordem.

---

## 4. Responsabilidades frontend vs backend

### Opções

| Responsabilidade | Frontend pesado | Backend pesado | Balanceado |
|------------------|-----------------|----------------|------------|
| **Lógica de reconnect** | Cliente implementa backoff, retry | Servidor assiste (ex.: reconnect tokens) | Cliente retenta; servidor stateless |
| **Deduplicação** | Cliente deduplica por message ID | Servidor deduplica antes do fan-out | Cliente deduplica (at-least-once) |
| **Ordenação** | Cliente ordena por timestamp/sequence | Servidor entrega pré-ordenado | Servidor impõe ordem; cliente confia na sequence |
| **Backfill** | Cliente solicita ranges; mescla localmente | Servidor empurra estado completo ao conectar | Cliente solicita por cursor; servidor retorna chunk ordenado |
| **UI otimista** | Cliente mostra imediatamente; rollback em falha | Cliente espera ack | Cliente mostra no envio; atualiza em ack/falha |

### Decisão: **Balanceado, com fronteiras claras**

| Responsabilidade | Dono | Racional |
|------------------|-----|----------|
| **Reconnect, backoff, requisições de backfill** | Frontend | Estado de rede é local ao cliente; servidor permanece stateless |
| **Deduplicação** | Frontend | At-least-once implica duplicatas; cliente tem message IDs (INV-003) |
| **Ordenação** | Backend | INV-008; servidor é fonte da verdade para sequence |
| **Resposta de backfill** | Backend | Servidor retorna chunks ordenados, baseados em cursor |
| **UI otimista** | Frontend | Mostrar no envio; substituir por resposta do servidor em ack; rollback em erro |
| **Membership, autorização** | Backend | INV-002, INV-013; servidor nunca confia no cliente para quem recebe o quê |

### Justificativa

- **Backend:** Fonte da verdade para ordem, membership, persistência. Nenhuma confiança no cliente para escopo de entrega.
- **Frontend:** Cuida do ciclo de vida da conexão, retries e UX local (exibição otimista, dedup). Mantém backend stateless e mais fácil de escalar.
- **Contrato de protocolo:** Backend define formato de mensagem, semântica de sequence e API de cursor/backfill. Frontend implementa o lado cliente desse contrato.

---

## 5. Latência vs custo

### Opções

| Dimensão | Baixa latência | Baixo custo | Trade-off |
|----------|----------------|-------------|-----------|
| **Persistência** | Write-behind (ack antes de persistir) | Write-through (persistir antes de ack) | Write-behind: ack mais rápido, risco de perda em crash |
| **Replicação** | Replicação síncrona | Replicação assíncrona | Sync: maior latência, durabilidade mais forte |
| **Caching** | Cache agressivo (membership, dados quentes) | Menos caches, mais leituras de DB | Cache: menor latência, mais infra, complexidade de invalidação |
| **Conexões** | Sticky sessions (cliente fica no mesmo nó) | Stateless (qualquer nó) | Sticky: menos hops, menor latência; scaling precisa de migração de sessão |
| **Broadcast** | Fan-out in-memory no mesmo nó | Message broker (Kafka, etc.) | In-memory: mais rápido; broker: durabilidade, entre nós |
| **Geográfico** | Multi-região, roteamento de baixa latência | Região única | Multi-região: menor latência para usuários; maior custo, complexidade |

### Decisão: **Priorizar latência dentro de restrições de durabilidade**

| Escolha | Decisão | Justificativa |
|---------|---------|---------------|
| **Persistência** | Write-through | INV-007: ack implica persistência. Write-behind arrisca perda silenciosa. Custo de latência aceitável para correção. |
| **Replicação** | Assíncrona (para escala) | Replicação sync adiciona latência. Para chat, assíncrona + backfill em reconnect é aceitável. |
| **Caching** | Cache de membership e conversas quentes | Membership usado em todo fan-out; cache reduz carga no DB e latência. Invalidar em join/leave. |
| **Conexões** | Sticky sessions quando possível | Reduz número de hops; backfill continua funcionando se sessão migrar. |
| **Broadcast** | In-memory para MVP; broker para multi-nó | MVP: nó único, in-memory. Escala: adicionar broker para fan-out entre nós sem reescrever protocolo. |
| **Geográfico** | Região única para MVP | Multi-região é passo futuro de escala; não necessário para metas iniciais. |

### Justificativa

- **Invariante primeiro:** Otimizações de latência que violam invariantes (ex.: write-behind violando INV-007) são rejeitadas.
- **Trade-offs medidos:** Aceitamos latência de write-through para preservar semântica de ack. Aceitamos replicação assíncrona para escala, com backfill cobrindo lacunas temporárias.
- **MVP vs escala:** MVP mantém custos baixos (região única, broadcast in-memory). Escala adiciona custo (broker, cache, sticky sessions) apenas quando necessário para atingir metas de latência.

---

## Resumo

| Trade-off | Decisão | Motivo principal |
|-----------|---------|-------------------|
| Transporte em tempo real | WebSocket | Latência subsegundo; polling não atinge P99 < 500ms |
| Garantia de entrega | At-least-once | Sem perda silenciosa; cliente deduplica por ID |
| Consistência | Ordem total por conversa | INV-008; ordem única para todos participantes |
| Frontend vs backend | Balanceado; backend = ordem, auth; frontend = reconnect, dedup, UI otimista | Fronteiras claras; backend stateless |
| Latência vs custo | Write-through; cache de membership; broadcast in-memory no MVP | Invariantes superam latência; otimizar onde invariantes permitem |

---

## Documentos relacionados

- [01 — Definição do Problema](./01-problem-definition.md)
- [02 — Invariantes do Sistema](./02-system-invariants.md)
