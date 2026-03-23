# 11 - Casos Reais de Mensageria (todo Staff/Principal deve conhecer)

> Casos de empresas que escalaram mensageria em tempo real. Cada um com link para o artigo ou tech blog original.

---

## Para que servem esses casos

Leve o link para a reunião quando defender decisões de arquitetura. Cite em ADRs ("como no caso do Slack…"). Use números e fontes reais em propostas para negócio.

---

## 1. Slack: Real-time Messaging

| Aspecto | Descrição |
|---------|-----------|
| **Desafio** | Milhões de mensagens/dia em milhões de canais; baixa latência; múltiplas regiões |
| **Arquitetura** | Channel Servers (in-memory, consistent hashing), Gateway Servers (WebSocket, multi-região), Kafka para ingestão, Fanout Services |
| **Práticas** | Fan-out via Kafka; WebSocket com long polling fallback; Redis/Memcache; session store por usuário |
| **Escala** | ~16M canais por host em pico; descoberta de serviços via Consul; CHARMs para hash ring |
| **Link** | [Real-time Messaging \| Engineering at Slack](https://slack.engineering/real-time-messaging/) |

---

## 2. Discord: Billions → Trillions of Messages

| Aspecto | Descrição |
|---------|-----------|
| **Desafio** | Migração de MongoDB para Cassandra; 120M+ msg/dia (2017); trilhões em 2023 |
| **Arquitetura** | Cassandra particionado por channel + time bucket; append-only writes |
| **Práticas** | Particionamento por canal e janela temporal; quorum consistency; 177 nós (2023) |
| **Lições** | Hot partitions em canais quentes; compactions atrasadas; migração MongoDB→Cassandra por throughput |
| **Link** | [How Discord Stores Billions of Messages](https://discord.com/blog/how-discord-stores-billions-of-messages) · [Trillions](https://discord.com/blog/how-discord-stores-trillions-of-messages) |

---

## 3. WhatsApp: Erlang e 2B+ usuários

| Aspecto | Descrição |
|---------|-----------|
| **Desafio** | Conexões concorrentes massivas; 100B+ mensagens/dia; ~50 engenheiros |
| **Arquitetura** | Erlang; processo leve por conexão; supervisors para fault tolerance; hot code swap |
| **Práticas** | Actor model; "let it crash"; conexões como processos Erlang; fila offline por usuário |
| **Escala** | ~550 servidores, 147M conexões concorrentes; 2M+ conexões/servidor; 712K msg/s outbound |
| **Link** | [Erlang Factory 2014 – Rick Reed](http://www.erlang-factory.com/sfbay2014/rick-reed) |

---

## 4. Slack: Message Fanout

| Aspecto | Descrição |
|---------|-----------|
| **Desafio** | Entregar uma mensagem a N destinatários em N dispositivos e conexões |
| **Arquitetura** | Kafka → Fanout Workers → WebSocket (por conexão ativa) |
| **Práticas** | Consistência de presença; cache de lookups; roteamento por user_id |
| **Link** | Artigos secundários sobre [Slack Fanout Architecture](https://scalewithchintan.com/blog/slack-message-fanout-architecture) |

---

## 5. Discord: Indexação de trilhões

| Aspecto | Descrição |
|---------|-----------|
| **Desafio** | Buscar em trilhões de mensagens; latência previsível; manutenção do cluster |
| **Arquitetura** | Cassandra + estratégias de indexação; particionamento refinado |
| **Práticas** | Leitura por canal + cursor; otimização de compactions; garbage collection |
| **Link** | [How Discord Indexes Trillions of Messages](https://discord.engineering/blog/how-discord-indexes-trillions-of-messages) |

---

## Casos complementares (frontend)

Para performance de UI e entregabilidade, veja também: [Frontend Architecture Playbook: 19 Casos](https://frontend-architecture-playbook-eight.vercel.app/guides/cases) (Netflix, Shopify, Slack desktop, eBay, etc.).

---

## Documentos relacionados

- [04 - Arquitetura](./04-architecture.md)
- [06 - Escalabilidade](./06-scalability.md)
- [10 - Evolução](./10-evolution.md)
- [docs/adr/](../adr/): ADRs do projeto
