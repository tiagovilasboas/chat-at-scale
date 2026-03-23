# ADR-001: WebSocket como protocolo primário

## Status

Aceito

## Data

2025-03-23

## Contexto

O sistema exige entrega em tempo real com latência subsegundo (P99 < 500ms em escala). Precisamos escolher o protocolo de comunicação cliente–servidor para envio e recebimento de mensagens.

Restrições: suporte a 10k–50k conexões simultâneas, 1k–2k msg/s de pico, reconexão frequente em cenários móveis.

## Decisão

WebSocket como protocolo primário para comunicação em tempo real. Sem fallback de long-polling no MVP.

## Alternativas consideradas

### WebSocket
- Prós: baixa latência, bidirecional, eficiente em escala (conexão persistente)
- Contras: gerenciamento de conexão mais complexo, problemas com firewall/proxy

### Short polling
- Prós: simples, stateless, funciona em todo lugar
- Contras: alta latência, desperdício quando idle, mais carga em escala

### Long polling
- Prós: melhor que short; menos requisições
- Contras: overhead por mensagem; churn de conexão

### Server-Sent Events (SSE)
- Prós: mais simples que WebSocket; auto-reconnect no browser
- Contras: unidirecional; precisa canal separado para envio

## Consequências

### Positivas
- Entrega subsegundo viável (push, não polling)
- Eficiência em escala: uma conexão por cliente
- Alinhado com INV-010 (latência limitada)
- Caminho MVP→escala claro (sticky sessions ou pub/sub)

### Negativas
- Dois caminhos de código se adicionarmos fallback no futuro
- Proxies corporativos raros podem bloquear WebSocket

### Riscos
- Se WebSocket for bloqueado em ambientes específicos, revisitamos fallback como melhoria futura

## Referências

- [03 - Trade-offs](../pt-br/03-trade-offs.md)
- [04 - Arquitetura](../pt-br/04-architecture.md)
