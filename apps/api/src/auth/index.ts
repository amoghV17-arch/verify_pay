import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { SignJWT, jwtVerify } from 'jose';
import fastifyCookie from '@fastify/cookie';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects } from '../db/schema.js';

export interface SessionPayload {
  userId: string;
  role: 'client' | 'freelancer';
  name?: string;
  email?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionPayload;
  }
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'milestone-hackathon-secure-session-secret-key-32b'
);

export const COOKIE_CLIENT = 'ms_client';
export const COOKIE_FREELANCER = 'ms_freelancer';
export const COOKIE_LEGACY = 'milestone_session';

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
      name: payload.name as string | undefined,
      email: payload.email as string | undefined,
    };
  } catch {
    return null;
  }
}

export function setRoleSessionCookie(
  reply: FastifyReply,
  role: 'client' | 'freelancer',
  token: string
): void {
  const cookieName = role === 'client' ? COOKIE_CLIENT : COOKIE_FREELANCER;
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  reply.setCookie(cookieName, token, cookieOptions);
  // Also set legacy cookie for backward compatibility
  reply.setCookie(COOKIE_LEGACY, token, cookieOptions);
}

async function authPlugin(server: FastifyInstance): Promise<void> {
  await server.register(fastifyCookie, {
    secret: process.env.SESSION_SECRET || 'milestone-cookie-secret-32-chars-long!',
  });

  // Global preHandler hook to parse session cookies with X-Persona header support
  server.addHook('preHandler', async (request: FastifyRequest) => {
    const personaHeader = (request.headers['x-persona'] as string | undefined)?.toLowerCase();
    let token: string | undefined;

    if (personaHeader === 'client') {
      token = request.cookies[COOKIE_CLIENT] || request.cookies[COOKIE_LEGACY];
    } else if (personaHeader === 'freelancer') {
      token = request.cookies[COOKIE_FREELANCER] || request.cookies[COOKIE_LEGACY];
    } else {
      // Path-based determination or fallback
      const url = request.url;
      if (url.startsWith('/api/freelancer') || url.startsWith('/freelancer')) {
        token = request.cookies[COOKIE_FREELANCER] || request.cookies[COOKIE_CLIENT] || request.cookies[COOKIE_LEGACY];
      } else if (url.startsWith('/api/client') || url.startsWith('/client')) {
        token = request.cookies[COOKIE_CLIENT] || request.cookies[COOKIE_FREELANCER] || request.cookies[COOKIE_LEGACY];
      } else {
        // Fallback: check client cookie, then freelancer cookie, then legacy
        token = request.cookies[COOKIE_CLIENT] || request.cookies[COOKIE_FREELANCER] || request.cookies[COOKIE_LEGACY];
      }
    }

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
      const targetName = targetRole === 'client' ? 'Sarah Lin (Acme Corp)' : 'Arjun Mehta';

      const token = await createSessionToken({
        userId: targetUserId,
        role: targetRole,
        name: targetName,
      });

      setRoleSessionCookie(reply, targetRole, token);

      return reply.send({
        success: true,
        user: {
          id: targetUserId,
          role: targetRole,
          name: targetName,
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
        name: request.user.name || (request.user.role === 'client' ? 'Sarah Lin (Acme Corp)' : 'Arjun Mehta'),
      },
    });
  });
}

export const registerAuth = fp(authPlugin);

/**
 * Middleware ensuring caller has one of the allowed project roles.
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

/**
 * Middleware ensuring caller is an authorized member (client or freelancer) of the specified project.
 */
export function requireProjectMember() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id?: string; projectId?: string };
    const projId = params.id || params.projectId;
    if (!projId) return;

    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, projId)).limit(1);
    if (!proj) {
      return reply.status(404).send({ error: 'NotFound', message: `Project "${projId}" not found.` });
    }

    const userId = request.user?.userId;
    const isClient = userId === proj.clientId || (!userId && request.user?.role === 'client');
    const isFreelancer = userId === proj.freelancerId || (!userId && request.user?.role === 'freelancer');

    if (!isClient && !isFreelancer) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You are not an authorized member of this project.',
      });
    }
  };
}
