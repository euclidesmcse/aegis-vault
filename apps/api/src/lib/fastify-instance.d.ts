// Declaracao unica da extensao da FastifyInstance para evitar duplicacao entre
// auth e context. Nao inclua 'export' para ser tratado como script de tipos.
import type { FastifyRequest, FastifyInstance } from 'fastify';
import type postgres from 'postgres';
import type { AuthContext } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest { requestId: string; }
  interface FastifyInstance {
    pg: postgres.Sql;
    authenticate(req: FastifyRequest): Promise<AuthContext | null>;
  }
}
export {};
