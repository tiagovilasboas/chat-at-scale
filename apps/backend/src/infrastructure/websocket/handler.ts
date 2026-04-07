import { FastifyInstance } from 'fastify';
import { BroadcastMessageUseCase } from '../../application/use-cases/broadcast-message';
import { BackfillMessagesUseCase } from '../../application/use-cases/backfill-messages';

const broadcastUseCase = new BroadcastMessageUseCase();
const backfillUseCase = new BackfillMessagesUseCase();
const DEFAULT_CONVERSATION = '11111111-1111-1111-1111-111111111111';

export function setupWebSocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection: any, req: any) => {
    const userId = req.query.userId || `Guest_${Math.floor(Math.random() * 1000)}`;
    
    fastify.log.info(`User connected: ${userId} to Room: Global`);
    connection.socket.send(JSON.stringify({ type: 'connected', user: userId }));

    connection.socket.on('message', async (rawMessage: any) => {
      fastify.log.info(`Received from ${userId}: ${rawMessage}`);
      
      try {
        let payload;
        try {
          payload = JSON.parse(rawMessage.toString());
        } catch {
          // If message is loose text (no structure)
          payload = { type: 'message', content: rawMessage.toString() };
        }

        // Logic branching: if system requests hydration
        if (payload.type === 'sync') {
          const cursor = payload.cursor || 0;
          const history = await backfillUseCase.execute(DEFAULT_CONVERSATION, cursor);
          
          connection.socket.send(JSON.stringify({ 
            type: 'sync_result', 
            messages: history 
          }));
          return;
        }

        // Logic branching: Standard Broadcast
        // Save using clean-arch Write-through pattern
        const savedMessage = await broadcastUseCase.execute({
          conversationId: DEFAULT_CONVERSATION,
          senderId: userId,
          content: payload.content || payload
        });

         // MVP in-memory fan-out
        const msgPayload = JSON.stringify({ 
          type: 'message', 
          ...savedMessage
        });
        
        // Broadcast locally to all websocket clients
        fastify.websocketServer.clients.forEach(client => {
          if (client.readyState === 1 /* OPEN */) {
            client.send(msgPayload);
          }
        });

      } catch (err: any) {
        fastify.log.error(err, 'Failed to process socket message');
      }
    });

    connection.socket.on('close', () => {
      fastify.log.info(`User disconnected: ${userId}`);
    });
  });
}
