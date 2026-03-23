# 04 - Arquitetura

> Visão geral dos componentes, responsabilidades e fluxo de dados. Clareza sobre complexidade.

**Staff/Principal:** Arquitetura é consequência de problema definido + invariantes + trade-offs. Se você desenha componentes antes de ter isso claro, está construindo em areia. Revise os docs 01-03 antes de desenhar caixas e setas.

---

## Diagrama de componentes

```
┌─────────────┐                    ┌─────────────────────────────────────────┐
│   Cliente   │◄──────────────────│              Gateway                    │
│             │     WebSocket       │  • Conexões WebSocket                   │
│  • Conectar │───────────────────►│  • Auth (validar token)                 │
│  • Enviar   │     (bidirecional) │  • Rotear entrada → Messaging            │
│  • Receber  │                    │  • Empurrar saída → Clientes             │
│  • Backfill │                    │  • Heartbeat                            │
└─────────────┘                    └────────────────────┬────────────────────┘
        │                                               │
        │ HTTP (backfill)                               │
        │ (opcional: pode ser via WS)                   │
        ▼                                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        Sistema de Mensagens                                │
│  • Validar mensagem + membership                                            │
│  • Atribuir sequence (ordem total por conversa)                             │
│  • Persistir (write-through)                                               │
│  • Fan-out aos participantes (in-memory no MVP; broker em escala)          │
└────────────────────────────────────────────────────────┬──────────────────┘
                                                           │
                                                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Persistência                                     │
│  • Mensagens (id, conversation_id, sequence, content, sender, timestamp)   │
│  • Conversas + membership                                                  │
│  • Queries de backfill (por conversa + cursor)                             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes principais

### 1. Cliente

| Responsabilidade | Descrição |
|------------------|-----------|
| **Conectar** | Estabelecer WebSocket ao Gateway; incluir token de auth (ex.: JWT) |
| **Reconectar** | Backoff, retry em desconexão; re-inscrever em conversas |
| **Enviar** | Emitir mensagem ao Gateway; UI otimista; tratar ack / erro |
| **Receber** | Consumir mensagens empurradas; deduplicar por message ID |
| **Backfill** | Ao conectar/reconectar, solicitar mensagens após cursor; mesclar no stream local |
| **Heartbeat** | Responder a ping ou enviar heartbeat periódico para manter conexão viva |

**Fora do escopo (Cliente):** Ordenação (confia na sequence do servidor), autorização (servidor impõe).

---

### 2. Gateway

| Responsabilidade | Descrição |
|------------------|-----------|
| **Servidor WebSocket** | Aceitar conexões; manter uma conexão por cliente |
| **Auth** | Validar token ao conectar; rejeitar ou fechar se inválido; associar conexão a user ID |
| **Roteamento** | Encaminhar mensagens de entrada (send, subscribe) ao Sistema de Mensagens |
| **Push** | Receber eventos de fan-out do Messaging; empurrar para clientes conectados (por user ID) |
| **Heartbeat** | Enviar ping/pong; fechar conexões obsoletas |
| **Proxy de backfill** | Encaminhar requisição de backfill ao Messaging; retornar chunk ordenado ao cliente |

**Escalando:** Em escala, múltiplas instâncias de Gateway; sticky sessions ou pub/sub compartilhado para Messaging alcançar o Gateway correto por usuário.

---

### 3. Sistema de Mensagens

| Responsabilidade | Descrição |
|------------------|-----------|
| **Validar** | Garantir que remetente seja membro da conversa; formato de mensagem válido |
| **Sequence** | Atribuir número de sequence monotônico por conversa (fonte da ordem total) |
| **Persistir** | Write-through à Persistência antes do ack (INV-007) |
| **Fan-out** | Para cada mensagem, determinar destinatários pelo membership; entregar aos Gateway(s) para usuários conectados |
| **Membership** | Resolver membros da conversa (da Persistência ou cache); INV-013 |

**MVP:** Processo único; fan-out in-memory para Gateway no mesmo nó.  
**Escala:** Processo separado; message broker para fan-out entre nós; Gateway se inscreve por usuário.

---

### 4. Persistência

| Responsabilidade | Descrição |
|------------------|-----------|
| **Mensagens** | Armazenar id, conversation_id, sequence, content, sender_id, timestamp |
| **Conversas** | conversation_id, metadados |
| **Membership** | Quais usuários estão em quais conversas; usado para escopo de fan-out e backfill |
| **Backfill** | Query de mensagens por conversation_id, após cursor de sequence, limit N; ordenado por sequence |

**MVP:** DB único (ex.: Postgres).  
**Escala:** Shard por conversation_id; ou store time-series para mensagens.

---

## Ciclo de vida da mensagem (caminho de envio)

```
  Cliente          Gateway         Messaging         Persistência
    │                │                │                  │
    │  send(msg)     │                │                  │
    │──────────────►│                │                  │
    │                │  route         │                  │
    │                │──────────────►│                  │
    │                │                │  validate        │
    │                │                │  membership      │
    │                │                │  assign seq      │
    │                │                │  persist         │
    │                │                │─────────────────►│
    │                │                │◄─────────────────│  ok
    │                │                │                  │
    │                │                │  fan-out          │
    │                │  push(msg)     │─────────────────►│  (para destinatários)
    │                │◄──────────────│                  │
    │  ack(msg)      │                │                  │
    │◄───────────────│                │                  │
    │                │  push(msg)     │                  │  (para outros clientes)
    │                │───────────────►│  (outras conns)  │
```

**Ordem:** Validar → Persistir (write-through) → Ack remetente → Fan-out. Sem ack antes de persistir.

---

## Ciclo de vida da mensagem (caminho de recebimento – tempo real)

```
  Cliente A         Gateway         Messaging         Cliente B
  (destinatário)                     (fan-out)         (remetente)
      │                │                │                │
      │                │                │   send(msg)    │
      │                │                │◄───────────────│
      │                │                │  persist       │
      │                │                │  fan-out       │
      │                │  push(msg)      │───────────────►│
      │  push(msg)     │◄──────────────│                │
      │◄───────────────│                │                │
      │  exibir        │                │                │
```

---

## Fluxo de backfill (recuperação em reconnect)

```
  Cliente            Gateway         Messaging         Persistência
    │                  │                │                  │
    │  connect         │                │                  │
    │  backfill(conv, cursor)         │                  │
    │────────────────►│                │                  │
    │                  │  req backfill  │                  │
    │                  │──────────────►│                  │
    │                  │                │  query(conv, cursor, limit)
    │                  │                │────────────────►│
    │                  │                │◄─────────────────│  messages[]
    │                  │  messages[]    │                  │
    │                  │◄───────────────│                  │
    │  messages[]      │                │                  │
    │◄─────────────────│                │                  │
    │  merge, dedup, render             │                  │
```

**Cursor:** Último número de sequence visto para aquela conversa. Cliente envia cursor; servidor retorna mensagens com sequence > cursor, ordenadas.

---

## Topologia de implantação (MVP vs escala)

### MVP (nó único)

```
                    ┌─────────────────────────────────┐
                    │           Nó Único               │
  Clientes ─────────►│  Gateway + Messaging (combinado) │
                    │         Persistência (DB)         │
                    └─────────────────────────────────┘
```

Gateway e Messaging podem ser um processo por simplicidade. Fan-out in-memory.

### Escala (multi-nó)

```
  Clientes ───► Load Balancer ───► Gateway 1 ─┐
                        ───────► Gateway 2 ─┼──► Message Broker ──► Messaging ──► Persistência
                        ───────► Gateway N ─┘         (pub/sub)
```

- Sticky sessions: cliente permanece no mesmo Gateway.
- Messaging publica no broker; Gateways se inscrevem por usuário/sala.
- Fan-out mais amplo e durabilidade em escala.

---

## Documentos relacionados

- [01 - Definição do Problema](./01-problem-definition.md)
- [02 - Invariantes do Sistema](./02-system-invariants.md)
- [03 - Trade-offs](./03-trade-offs.md)
