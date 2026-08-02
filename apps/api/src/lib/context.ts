import { ulidNow } from '@aegis/crypto';
import type { FastifyReply, FastifyRequest, FastifyError } from 'fastify';
import { problem, type ProblemDetails } from '@aegis/contracts';

export async function requestContext(req: FastifyRequest, _reply: FastifyReply) {
  const existing = req.headers['x-request-id'];
  req.requestId = (typeof existing === 'string' && existing.length > 0) ? existing : ulidNow();
}

export function problemDetailsHandler(err: FastifyError, req: FastifyRequest, reply: FastifyReply): FastifyReply {
  const status = err.statusCode ?? 500;
  let title = err.name ?? 'Error';
  if (status === 401) title = 'Authentication required';
  else if (status === 403) title = 'Forbidden';
  else if (status === 404) title = 'Not found';
  else if (status === 409) title = 'Conflict';
  else if (status === 410) title = 'No longer available';
  else if (status === 429) title = 'Rate limited';
  else if (status >= 500) title = 'Server error';
  const body: ProblemDetails = problem(status, title, err.message);
  body.instance = `/api/v1${req.url}`;
  return reply.code(status).type('application/problem+json').send(body);
}
