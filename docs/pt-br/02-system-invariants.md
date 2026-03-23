# 02 — Invariantes do Sistema

> **Invariantes** são propriedades que o sistema **sempre** mantém, independente de carga, falhas ou estado. Violar um invariante indica bug ou design incorreto.

---

## O que jamais pode quebrar

### INV-001: Integridade do conteúdo da mensagem

- **Regra:** Uma mensagem entregue a um destinatário é byte-idêntica ao que o remetente submeteu.
- **Por quê:** Usuários devem confiar que suas palavras não são alteradas em trânsito. Corrupção destrói confiança e pode causar problemas de segurança.
- **Validação:** Checksum ou comparação de hash no caminho de envio vs recebimento.
- **Violação:** Corrupção de dados; usuários veem conteúdo errado; possíveis ataques de injection.

### INV-002: Isolamento de fronteira de conversa

- **Regra:** Um participante recebe mensagens apenas de conversas das quais é membro. Um participante jamais recebe mensagens de conversas às quais não tem acesso.
- **Por quê:** Privacidade e segurança. Vazar mensagens entre salas é falha crítica.
- **Validação:** Verificação de autorização em todo fan-out; auditoria de que roteamento usa dados de membership.
- **Violação:** Vazamento entre salas; usuários veem mensagens de salas que não participam.

### INV-003: Imutabilidade da identidade da mensagem

- **Regra:** Toda mensagem tem um ID único e imutável atribuído pelo sistema. O mesmo ID sempre se refere à mesma mensagem lógica. IDs nunca são reutilizados.
- **Por quê:** Permite deduplicação, backfill, retries idempotentes e ordenação no cliente. Reutilização causa bugs de dedup e exibição de duplicatas.
- **Validação:** Restrição de unicidade de ID no storage; esquema monotônico ou UUID com verificação de colisão.
- **Violação:** Deduplicação falha; clientes mostram duplicatas ou pulam mensagens; backfill incorreto.

### INV-004: Sem drop silencioso de mensagem

- **Regra:** Se o sistema aceita uma mensagem do remetente (retorna sucesso/ack), essa mensagem será eventualmente entregue a todos os destinatários pretendidos (online agora ou na próxima conexão). O sistema nunca reconhece uma mensagem e depois descarta sem caminho de recuperação.
- **Por quê:** Reconhecimento implica compromisso. Perda silenciosa após ack destrói confiança do usuário.
- **Validação:** Testes ponta a ponta; logs de auditoria de acked vs delivered; alerta em divergência.
- **Violação:** Usuário acredita que mensagem foi enviada; destinatários nunca veem; nenhum erro reportado.

---

## Expectativas de entrega

### INV-005: Garantia de entrega at-least-once

- **Regra:** Toda mensagem persistida é entregue pelo menos uma vez a cada participante da conversa. Duplicatas são aceitáveis; perda não é.
- **Por quê:** Usuários de chat esperam "enviar e esquecer" com visibilidade eventual. At-most-once ou best-effort é insuficiente para plataforma de mensagens.
- **Validação:** Para cada conversa, rastrear última sequência entregue por participante; backfill garante fechamento de lacunas.
- **Violação:** Mensagens faltando para alguns participantes; estado da conversa diverge; relatos de "nunca recebi".

### INV-006: Recuperação de participante offline

- **Regra:** Mensagens enviadas enquanto um participante está desconectado ficam disponíveis ao reconectar. O sistema serve backfill (por sequence/cursor) para que o cliente atinja estado consistente.
- **Por quê:** Chat é assíncrono do ponto de vista do destinatário. Usuários offline devem alcançar.
- **Validação:** Desconectar cliente, enviar mensagens, reconectar; verificar que backfill contém todas as mensagens perdidas.
- **Violação:** Usuários perdem mensagens permanentemente; tickets de suporte "mensagens desapareceram".

### INV-007: Semântica de reconhecimento do remetente

- **Regra:** Quando o sistema retorna sucesso ao remetente, significa: (a) a mensagem foi aceita, (b) será persistida (ou já está), e (c) será entregue a todos participantes. Sucesso nunca é retornado antes de persistência garantida (ou caminho de escrita durável definido existir).
- **Por quê:** Remetentes inferem "mensagem enviada" do ack. Mentir sobre persistência causa perda quando crashes ocorrem.
- **Validação:** Matar processo após ack mas antes de persistir; verificar que mensagem não foi perdida (ou documentar risco aceito).
- **Violação:** Remetente vê sucesso; crash perde mensagem; destinatário nunca recebe.

---

## Garantias de experiência do usuário

### INV-008: Consistência de ordem por conversa

- **Regra:** Dentro de uma única conversa, todo participante observa a mesma ordem total de mensagens. Existe uma única sequência canônica; nenhum participante vê ordem diferente.
- **Por quê:** Threads de chat devem ser legíveis. Mensagens fora de ordem causam confusão e quebram threading/replies.
- **Validação:** Teste multi-cliente: todos participantes afirmam sequência idêntica para mesma conversa.
- **Violação:** Usuário A vê M1→M2→M3; Usuário B vê M2→M1→M3; replies e contexto quebram.

### INV-009: Read-your-writes

- **Regra:** Após um cliente enviar uma mensagem e receber reconhecimento, esse cliente vê imediatamente a mensagem no stream da conversa (via push em tempo real ou via próximo read/backfill).
- **Por quê:** Remetentes esperam ver sua própria mensagem aparecer. Atrasar cria dúvida ("foi enviada?").
- **Validação:** Enviar mensagem, afirmar que aparece no stream local sem refresh.
- **Violação:** Remetente não vê própria mensagem; envios repetidos; UX ruim.

### INV-010: Latência limitada (em escala)

- **Regra:** Na escala de produção, latência de entrega (envio a recebimento) é P99 < 500ms para participantes conectados no momento do envio.
- **Por quê:** Chat em tempo real parece quebrado quando mensagens chegam com segundos de atraso. Este é um invariante de UX.
- **Validação:** Load test com percentis de latência; monitoramento de SLO.
- **Violação:** Chat parece lento; usuários mudam para concorrentes.

### INV-011: Reconnect resulta em estado consistente

- **Regra:** Após um cliente desconectar e reconectar, o cliente pode obter visão consistente da conversa (todas mensagens até um ponto) via backfill. Nenhuma mensagem fica permanentemente invisível.
- **Por quê:** Usuários esperam "continuar de onde pararam" após instabilidades de rede ou reinícios do app.
- **Validação:** Desconectar, enviar N mensagens, reconectar, backfill; afirmar que cliente tem N mensagens em ordem.
- **Violação:** Lacunas no histórico; "reconectei e perdi 10 mensagens".

---

## Expectativas de consistência de dados

### INV-012: Sem mensagens fantasmas

- **Regra:** Uma mensagem aparece em uma conversa apenas se foi enviada por participante autenticado dessa conversa. O sistema nunca fabrica ou injeta mensagens.
- **Por quê:** Mensagens fantasmas indicam bug crítico ou comprometimento de segurança.
- **Validação:** Auditar origem da mensagem; nenhuma mensagem sem remetente válido e membership na conversa.
- **Violação:** Mensagens falsas; impersonação; comprometimento do sistema.

### INV-013: Membership da conversa como fonte da verdade

- **Regra:** Decisões de fan-out e entrega usam fonte de membership definida (ex.: banco, cache). Não há membership implícito ou obsoleto; joins/leaves são refletidos antes da entrega da mensagem.
- **Por quê:** Entregar a participantes errados ou faltar membros novos causa isolamento e confusão.
- **Validação:** Adicionar usuário à sala, enviar mensagem; novo membro recebe. Sair; nenhuma mensagem futura.
- **Violação:** Novo membro nunca vê mensagens; membro que saiu continua recebendo; pessoas erradas na sala.

### INV-014: Histórico monotônico

- **Regra:** Para uma conversa e cliente dados, a sequência de mensagens retornadas por backfill ou leituras de histórico é monotonicamente crescente por número de sequência. Sem saltos para trás; sem lacunas exceto paginação explícita.
- **Por quê:** Clientes dependem de sequence para ordenação e detecção de lacunas. Respostas não monotônicas quebram clientes.
- **Validação:** Solicitar histórico múltiplas vezes; afirmar que sequence é monotônica.
- **Violação:** Lógica do cliente falha; duplicatas ou pulos; loops infinitos de backfill.

---

## Resumo

| ID | Categoria | Regra em uma linha |
|----|-----------|--------------------|
| INV-001 | Nunca quebrar | Conteúdo da mensagem nunca é corrompido |
| INV-002 | Nunca quebrar | Mensagens apenas para membros da conversa |
| INV-003 | Nunca quebrar | IDs de mensagem são únicos e imutáveis |
| INV-004 | Nunca quebrar | Sem drop silencioso após ack |
| INV-005 | Entrega | At-least-once para todos participantes |
| INV-006 | Entrega | Usuários offline recebem backfill ao reconectar |
| INV-007 | Entrega | Ack implica garantia de persistência |
| INV-008 | UX | Mesma ordem para todos participantes |
| INV-009 | UX | Remetente vê própria mensagem após ack |
| INV-010 | UX | Latência P99 < 500ms em escala |
| INV-011 | UX | Reconnect resulta em backfill consistente |
| INV-012 | Consistência | Sem mensagens fantasma/fabricadas |
| INV-013 | Consistência | Membership é fonte da verdade para fan-out |
| INV-014 | Consistência | Histórico é monotônico por sequence |

---

## Documentos relacionados

- [01 — Definição do Problema](./01-problem-definition.md)
- [03 — Trade-offs](./03-trade-offs.md)
