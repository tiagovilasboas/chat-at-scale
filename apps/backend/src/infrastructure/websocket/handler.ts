import { FastifyInstance } from 'fastify';
import { BroadcastMessageUseCase } from '../../application/use-cases/broadcast-message';
import { BackfillMessagesUseCase } from '../../application/use-cases/backfill-messages';
import jwt from 'jsonwebtoken';

const broadcastUseCase = new BroadcastMessageUseCase();
const backfillUseCase = new BackfillMessagesUseCase();
const DEFAULT_CONVERSATION = '11111111-1111-1111-1111-111111111111';
const JWT_SECRET = process.env.JWT_SECRET || 'staff_principal_secret';

export function setupWebSocketRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, async (connection: any, req: any) => {
    const token = req.query.token;

    if (!token) {
      fastify.log.warn('Unauthorized WSS attempt: Missing token parameter');
      return connection.socket.close(1008, 'Policy Violation');
    }

    // Stateless JWT verification: validate signature and expiry.
    // TODO(Phase 5): Add Redis session cache check here to support instant revocation at scale.
    // Tracking: https://github.com/tiagovilasboas/chat-at-scale/issues (create issue when Redis is added)
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      fastify.log.warn('Unauthorized WSS attempt: Invalid or expired JWT');
      return connection.socket.close(1008, 'Policy Violation');
    }

    const userId = decoded.userId;
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
