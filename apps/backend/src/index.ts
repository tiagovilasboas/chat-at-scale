import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { setupWebSocketRoutes } from './infrastructure/websocket/handler';

const app = Fastify({ logger: true });

export async function bootstrap() {
  await app.register(cors, { origin: '*' });
  await app.register(websocket);

  // Register Handlers
  app.register(async (fastify) => {
    setupWebSocketRoutes(fastify);
  });

  try {
    await app.listen({ port: 8080, host: '0.0.0.0' });
    console.log('Clean Arch Gateway Running on ws://localhost:8080/ws');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
