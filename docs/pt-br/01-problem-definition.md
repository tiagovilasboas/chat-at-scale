# 01 - Definição do Problema

> Sistema de mensagens em tempo real que evolui de um MVP simples para uma plataforma escalável.  
> **Princípio:** Otimize pela clareza das decisões e do design sistêmico, não por código perfeito.

**Staff/Principal:** Este doc é o gate zero. Se o problema não está claro (o quê, restrições, escala, fora do escopo), pare. Código sem problema bem definido vira débito técnico disfarçado de progresso.

---

## O que estamos construindo

Um **sistema de chat em tempo real** que escala do MVP até uma plataforma de mensagens de produção:

| Capacidade | Descrição |
|------------|-----------|
| **Comunicação em tempo real** | Entrega e recebimento de mensagens em subsegundos |
| **Canais e grupos** | Salas e canais multiparticipantes |
| **Garantias de entrega** | At-least-once (ou exactly-once) com recuperação |
| **Resiliência a falhas** | Tolera falhas de componentes e de rede |
| **Alta concorrência** | Milhares de conexões simultâneas, suporte a bursts |

Um **desafio de sistemas distribuídos**: toda decisão envolve trade-offs explícitos entre consistência, disponibilidade, latência e custo.

**Por que chat?** Chat é um dos tipos de aplicação completa mais complexos que existem. Exige real-time, consistência, fan-out, reconexão, frontend como nó do sistema, observabilidade e evolução em escala. Exercita tudo o que um Staff/Principal precisa dominar. Casos reais (Slack, Discord, WhatsApp) provam que o problema é sério. Ver [11 - Casos de Mensageria](./11-casos-mensageria.md).

---

## Que problemas estamos resolvendo

| Problema | Descrição |
|----------|-----------|
| **Conexões em escala** | Milhares de conexões WebSocket estáveis; heartbeat, reconnect, backoff |
| **Entrega de mensagens** | Garantir que mensagens cheguem aos destinatários corretos (at-least-once ou exactly-once) |
| **Fan-out** | Distribuir eficientemente uma mensagem para N participantes em uma sala |
| **Persistência** | Armazenar mensagens para histórico e recuperação após desconexão |
| **Ordenação** | Preservar ordem consistente de mensagens por conversa por participante |
| **Escalabilidade horizontal** | Adicionar nós para suportar mais carga (stateful vs stateless) |
| **Tolerância a falhas** | Continuar operando quando componentes ou nós falham |
| **Recuperação** | Reconnect do cliente e backfill de mensagens perdidas durante janela de indisponibilidade |
| **Observabilidade** | Métricas, tracing, logs para operações e debug |

---

## O que NÃO estamos resolvendo

| Fora do escopo | Motivo |
|----------------|--------|
| **Autenticação e autorização** | Assume camada existente (OAuth, JWT) |
| **UI/UX do cliente** | Foco em backend, protocolo, infraestrutura |
| **Criptografia ponta-a-ponta (E2EE)** | Possível extensão futura |
| **Mídia** (arquivos, imagens, áudio) | Possível extensão : foco inicial em texto |
| **Push notifications** (mobile) | Possível extensão futura |
| **Moderação de conteúdo** | Possível extensão futura |
| **Presence** (online/offline) | Possível extensão futura |
| **Read receipts / typing indicators** | Possível extensão futura |
| **Multi-dispositivo por usuário** | Simplificação inicial : tratar depois |

---

## Validação de escopo (evitar over-engineering)

O design deste repo é completo pra plataforma. Pra MVP, valide o que realmente precisa do dia um. Clean Architecture em chat de 50 usuários pode ser overkill; em chat de 10k, faz sentido. Pergunte: "qual é o menor escopo que valida o problema?" antes de implementar tudo.

---

## Premissas de escala

### MVP (fase inicial)

| Dimensão | Meta | Prioridade |
|----------|------|------------|
| Conexões concorrentes | 100–500 | Validar fluxo ponta a ponta |
| Mensagens/dia | 10k–50k | Validar persistência e entrega |
| Salas ativas | 10–50 | Validar fan-out |
| Latência P99 | < 1s | Aceitável para validação |
| Disponibilidade | Best effort | Nó único suficiente |

**MVP prioriza:** funcionamento ponta a ponta, validação de decisões arquiteturais, feedback.

### Grande escala (meta de produção)

| Dimensão | Meta | Prioridade |
|----------|------|------------|
| Conexões concorrentes | 10k–50k | Topologia multi-nó |
| Mensagens/dia | 1M–10M | Throughput sustentável |
| Mensagens/s (pico) | 500–2k | Broadcast eficiente |
| Salas ativas | 1k–10k | Fan-out distribuído |
| Latência P99 | < 500ms | Experiência em tempo real |
| Disponibilidade | 99,9% | Tolerância a falhas |
| Tempo de recuperação | < 5s | Reconnect + backfill |

**Grande escala prioriza:** latência, confiabilidade, observabilidade, operações.

### Evolução MVP → escala

A arquitetura deve evoluir do MVP para escala **sem reescrita**. Componentes críticos (protocolo, modelo de dados, estratégia de persistência) são escolhidos com a meta de escala em mente.

| Aspecto | MVP | Grande escala | Consideração de design |
|---------|-----|---------------|------------------------|
| Topologia | Nó único | Multi-nó | Evitar estado local não replicável |
| Persistência | Monolito OK | Pode requerer sharding | Modelo de dados particionável |
| Broadcast | In-memory | Fan-out entre nós | Abstração para futuro broker |
| Sessão | Pode ser stateful | Stateless ou session store | Sticky sessions ou Redis |

---

## Tipos de usuários e padrões de uso

### Tipos de usuário

| Tipo | Comportamento | Consideração do sistema |
|------|---------------|--------------------------|
| **Humano (web)** | WebSocket, conexão relativamente estável | Reconnect em refresh |
| **Humano (mobile)** | Conexão intermitente | Background/foreground, push futuro |
| **Humano (desktop)** | Conexão estável | Similar ao web |
| **Bot / integração** | Alta taxa, programático | Rate limiting, QoS diferente |

### Modelos de conversa

| Modelo | Participantes | Características |
|--------|---------------|-----------------|
| **1:1 (DM)** | 2 | Fan-out = 1; simples |
| **Grupo pequeno** | 3–20 | Fan-out moderado; ordem importa |
| **Grupo médio** | 20–100 | Fan-out alto; padrões de leitura importam |
| **Canal/thread** | 10s–100s | Fan-out muito alto; possivelmente particionado |

### Padrões de tráfego

| Padrão | Descrição | Implicação |
|--------|-----------|------------|
| **Burst** | Picos de mensagens (ex.: evento ao vivo) | Buffer, back-pressure |
| **Estável** | Taxa constante baixa | Menor tensão |
| **Idle** | Muitas conexões, poucas mensagens | Manter conexões vivas (heartbeat) |
| **Mass reconnect** | Muitos clientes reconectando ao mesmo tempo | Evitar thundering herd |

### Requisitos de consistência

| Nível | Caso de uso | Requisito |
|-------|-------------|-----------|
| **Ordem forte** | Chat de suporte | Mesma ordem para todos participantes |
| **Ordem causal** | Chat social | Mensagens relacionadas na ordem correta |
| **Ordem relaxada** | Notificações | Entrega garantida, ordem secundária |

---

## Documentos relacionados

- [02 - Invariantes do Sistema](./02-system-invariants.md)
- [03 - Trade-offs](./03-trade-offs.md)
