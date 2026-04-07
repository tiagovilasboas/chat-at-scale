import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { setupWebSocketRoutes } from './infrastructure/websocket/handler';
import { setupAuthRoutes } from './infrastructure/http/auth';
import fastifyCookie from '@fastify/cookie';

const app = Fastify({ logger: true });

export async function bootstrap() {
  await app.register(cors, { origin: '*', credentials: true });
  await app.register(fastifyCookie);
  await app.register(websocket);

  // Register Handlers
  app.register(async (fastify) => {
    setupAuthRoutes(fastify);
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
