# Glossário

> Termos técnicos usados na documentação. Termos em inglês quando consagrados no domínio.

---

## A

**ack (acknowledgment)** — Confirmação do servidor de que a mensagem foi recebida e persistida. O remetente só considera "enviada" após o ack.

**at-least-once** — Garantia de entrega em que a mensagem chega uma ou mais vezes. Duplicatas são possíveis; o cliente deduplica por message_id.

---

## B

**backfill** — Requisição ao conectar ou reconectar para recuperar mensagens perdidas durante a janela de desconexão. O cliente envia um cursor (última sequence vista); o servidor retorna mensagens com sequence maior.

**backoff** — Estratégia de retry com intervalo crescente (ex.: 1s, 2s, 4s, 8s) entre tentativas de reconexão, para evitar thundering herd.

**broker** — Em escala: sistema de mensageria (ex.: Kafka, Redis Streams) que desacopla o produtor de mensagens dos consumidores (Gateways). Permite fan-out entre nós.

---

## C

**cursor** — Posição na sequência de mensagens. O cliente persiste `last_seen_sequence` por conversa e envia como `after_sequence` no backfill para receber apenas mensagens novas.

---

## D

**dedup (deduplicação)** — Remoção de duplicatas. Com at-least-once, o cliente deduplica por `message_id` antes de exibir.

**dependency rule** — Regra de dependências: camada de fora pode usar a de dentro; camada de dentro nunca usa a de fora. Base de Clean Architecture.

---

## F

**fan-out** — Distribuição de uma mensagem para N destinatários. Em MVP, in-memory no mesmo processo; em escala, via broker.

---

## G

**Gateway** — Componente que mantém conexões WebSocket com clientes, valida auth, roteia mensagens de entrada ao Messaging e empurra mensagens de saída aos clientes conectados.

---

## H

**heartbeat** — Ping/pong periódico para manter a conexão WebSocket viva e detectar desconexão.

---

## I

**idempotency_key** — Chave enviada pelo cliente no envio para permitir retry seguro. O servidor ignora duplicatas com a mesma chave.

**INV-XXX** — Identificador de invariante do sistema. Ver [02 — Invariantes](./02-system-invariants.md).

---

## M

**Membership** — Conjunto de participantes de uma conversa. Usado para determinar o escopo do fan-out e validar permissões.

**Messaging (Sistema de Mensagens)** — Componente que valida mensagens, atribui sequence, persiste e faz fan-out aos Gateways.

**message_id** — Identificador único e imutável da mensagem. Permite deduplicação no cliente.

---

## P

**push** — Entrega em tempo real da mensagem do servidor ao cliente via WebSocket (em contraste com pull/backfill).

**P50, P99** — Percentis de latência. P99 = 99% das requisições completam em menos que X ms.

---

## R

**reconnect** — Reestabelecimento da conexão WebSocket após queda. Inclui backoff, re-auth, re-subscribe e backfill.

**reconciliação** — Processo de alinhar estado local do cliente com o estado do servidor (ex.: após backfill, substituir mensagem otimista por definitiva).

---

## S

**sequence** — Número monotônico atribuído pelo servidor por conversa. Define a ordem total das mensagens; usado no backfill como cursor.

**sticky session** — Configuração do load balancer para que o mesmo cliente seja sempre direcionado ao mesmo Gateway, permitindo fan-out in-memory dentro do nó.

---

## T

**thundering herd** — Muitos clientes reconectando simultaneamente e sobrecarregando o servidor. Mitigação: jitter (delay aleatório) antes do backfill.

---

## U

**update otimista (optimistic update)** — Mostrar a mensagem na UI imediatamente ao enviar, antes do ack. Substituir pela mensagem definitiva no ack; rollback em falha.

---

## W

**WebSocket** — Protocolo de comunicação bidirecional e persistente sobre TCP. Usado como canal primário para mensagens em tempo real.

**write-through** — Estratégia de persistência em que o dado é gravado no armazenamento antes de confirmar a operação. Ack só após persistência.

---

## Referências

- [02 — Invariantes](./02-system-invariants.md)
- [04 — Arquitetura](./04-architecture.md)
- [05 — Modelo de Mensagens](./05-messaging-model.md)
