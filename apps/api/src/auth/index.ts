import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { SignJWT, jwtVerify } from 'jose';
import fastifyCookie from '@fastify/cookie';

export interface SessionPayload {
  userId: string;
  role: 'client' | 'freelancer';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionPayload;
  }
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'milestone-hackathon-secure-session-secret-key-32b'
);

const COOKIE_NAME = 'milestone_session';

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      role: payload.role as 'client' | 'freelancer',
    };
  } catch {
    return null;
  }
}

async function authPlugin(server: FastifyInstance): Promise<void> {
  await server.register(fastifyCookie, {
    secret: process.env.SESSION_SECRET || 'milestone-cookie-secret-32-chars-long!',
  });

  // Global preHandler hook to parse session cookie for all routes
  server.addHook('preHandler', async (request: FastifyRequest) => {
    const token = request.cookies[COOKIE_NAME];
    if (token) {
      const user = await verifySessionToken(token);
      if (user) {
        request.user = user;
      }
    }
  });

  // Persona Switch Endpoint
  server.post<{ Body: { persona?: 'client' | 'freelancer'; userId?: string } }>(
    '/api/auth/persona',
    async (request: FastifyRequest<{ Body: { persona?: 'client' | 'freelancer'; userId?: string } }>, reply: FastifyReply) => {
      const { persona, userId } = request.body || {};
      const targetRole = persona || (userId === 'user_freelancer_01' ? 'freelancer' : 'client');
      const targetUserId = userId || (targetRole === 'freelancer' ? 'user_freelancer_01' : 'user_client_01');

      const token = await createSessionToken({
        userId: targetUserId,
        role: targetRole,
      });

      reply.setCookie(COOKIE_NAME, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return reply.send({
        success: true,
        user: {
          id: targetUserId,
          role: targetRole,
          name: targetRole === 'client' ? 'Sarah Lin (Acme Corp)' : 'Arjun Mehta',
        },
      });
    }
  );

  // Current Auth Endpoint
  server.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.send({
        authenticated: true,
        user: {
          id: 'user_client_01',
          role: 'client',
          name: 'Sarah Lin (Acme Corp)',
        },
      });
    }

    return reply.send({
      authenticated: true,
      user: {
        id: request.user.userId,
        role: request.user.role,
        name: request.user.role === 'client' ? 'Sarah Lin (Acme Corp)' : 'Arjun Mehta',
      },
    });
  });
}

export const registerAuth = fp(authPlugin);

/**
 * Middleware ensuring caller has the required project role.
 */
export function requireRole(allowedRoles: Array<'client' | 'freelancer'>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user ? request.user.role : 'client';
    if (!allowedRoles.includes(userRole)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${userRole}.`,
      });
    }
  };
}
