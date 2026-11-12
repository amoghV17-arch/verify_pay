import { randomBytes, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { eq, or, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { invites, projects, users, activity } from '../db/schema.js';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function getInviteSecret(): string {
  return process.env.INVITE_SECRET || process.env.SESSION_SECRET || 'milestone-hackathon-invite-secret-32b!';
}

/**
 * Computes HMAC-SHA-256 hash for link token or Crockford code.
 */
export function hashInviteValue(value: string): string {
  const secret = getInviteSecret();
  return createHmac('sha256', secret).update(value.trim()).digest('hex');
}

/**
 * Generates Crockford base32 string of specified length.
 */
export function generateCrockfordBase32(length = 10): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    result += CROCKFORD_ALPHABET[byte % CROCKFORD_ALPHABET.length];
  }
  return result;
}

/**
 * Generates high-entropy link token (128-bit CSPRNG base64url) and short code (MILE-XXXXXXXXXX).
 */
export function generateInviteCredentials(): {
  token: string;
  code: string;
  tokenHash: string;
  codeHash: string;
} {
  const token = randomBytes(16).toString('base64url');
  const code = `MILE-${generateCrockfordBase32(10)}`;
  const tokenHash = hashInviteValue(token);
  const codeHash = hashInviteValue(code);

  return { token, code, tokenHash, codeHash };
}

/**
 * Constant-time comparison between a candidate string and a stored hash.
 */
export function verifyInviteHash(candidate: string, storedHash: string): boolean {
  const candidateHash = hashInviteValue(candidate);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// In-memory rate limiting map: ip -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limits lookups and accept attempts to max 10 per 10 minutes per IP.
 */
export function checkInviteRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAttempts = 10;

  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (current.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  return { allowed: true, remaining: maxAttempts - current.count };
}

/**
 * Helper to reset rate limits in testing environments.
 */
export function resetInviteRateLimits(): void {
  rateLimitMap.clear();
}

export class InviteService {
  /**
   * Creates a new invitation for a project. Plaintext credentials returned once.
   */
  async createInvite(params: {
    projectId: string;
    createdBy?: string;
    invitedEmail?: string;
    expiryDays?: number;
    maxUses?: number;
  }): Promise<{
    id: string;
    projectId: string;
    invitedEmail: string | null;
    token: string;
    code: string;
    expiresAt: Date;
    maxUses: number;
  }> {
    const db = getDb();
    const id = `inv_${randomUUID().slice(0, 10)}`;
    const { token, code, tokenHash, codeHash } = generateInviteCredentials();
    const expiryDays = params.expiryDays ?? 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const maxUses = params.maxUses ?? 1;
    const invitedEmail = params.invitedEmail?.trim().toLowerCase() || null;

    await db.insert(invites).values({
      id,
      projectId: params.projectId,
      createdBy: params.createdBy || null,
      invitedEmail,
      tokenHash,
      codeHash,
      expiresAt,
      maxUses,
      usedCount: 0,
    });

    return {
      id,
      projectId: params.projectId,
      invitedEmail,
      token,
      code,
      expiresAt,
      maxUses,
    };
  }

  /**
   * Finds and validates an invite by token or code.
   * Cleans inputs, hashes with HMAC-SHA-256, and checks status/expiry.
   * Returns null for any invalid state to preserve privacy.
   */
  async findValidInvite(tokenOrCode: string) {
    const db = getDb();
    // Normalize input: extract token from URL if full link pasted, remove whitespace, uppercase code
    let cleaned = tokenOrCode.trim();
    if (cleaned.includes('/')) {
      const parts = cleaned.split('/');
      cleaned = parts[parts.length - 1] || cleaned;
    }

    const hash = hashInviteValue(cleaned);
    const upperCodeHash = hashInviteValue(cleaned.toUpperCase());

    const [invite] = await db
      .select()
      .from(invites)
      .where(
        or(
          eq(invites.tokenHash, hash),
          eq(invites.codeHash, hash),
          eq(invites.codeHash, upperCodeHash)
        )
      )
      .limit(1);

    if (!invite) return null;

    // Check revocation
    if (invite.revokedAt != null) return null;

    // Check expiry
    if (new Date() >= new Date(invite.expiresAt)) return null;

    // Check usage
    if (invite.usedCount >= invite.maxUses) return null;

    return invite;
  }

  /**
   * Revokes an invitation.
   */
  async revokeInvite(inviteId: string, projectId?: string): Promise<boolean> {
    const db = getDb();
    const conditions = [eq(invites.id, inviteId), isNull(invites.revokedAt)];
    if (projectId) {
      conditions.push(eq(invites.projectId, projectId));
    }

    const [updated] = await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning();

    return !!updated;
  }

  /**
   * Accepts an invitation for an authenticated user.
   * Enforces own-invite block, optional email targeting, and payout email requirement.
   */
  async acceptInviteForUser(
    tokenOrCode: string,
    user: {
      userId: string;
      name: string;
      email: string;
      payoutPaypalEmail: string | null;
    },
    opts?: { paypalEmail?: string }
  ): Promise<
    | {
        ok: true;
        project: { id: string; title: string };
        paypalEmail: string;
      }
    | {
        ok: false;
        status: 400 | 403 | 404;
        error: string;
        message: string;
      }
  > {
    const db = getDb();
    const invite = await this.findValidInvite(tokenOrCode);
    if (!invite) {
      return {
        ok: false,
        status: 400,
        error: 'InvalidInvitation',
        message: 'This invitation is no longer valid.',
      };
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, invite.projectId))
      .limit(1);

    if (!project) {
      return {
        ok: false,
        status: 404,
        error: 'InvalidInvitation',
        message: 'This invitation is no longer valid.',
      };
    }

    if (invite.createdBy === user.userId || project.clientId === user.userId) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden',
        message: 'You cannot accept your own project invitation. Share the invite link with your freelancer instead.',
      };
    }

    if (invite.invitedEmail && invite.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      return {
        ok: false,
        status: 403,
        error: 'InviteEmailMismatch',
        message: 'This invitation was issued for a different email address.',
      };
    }

    const suppliedPaypal = opts?.paypalEmail?.trim().toLowerCase();
    const finalPaypalEmail = suppliedPaypal || user.payoutPaypalEmail?.trim().toLowerCase() || '';
    if (!finalPaypalEmail) {
      return {
        ok: false,
        status: 400,
        error: 'PayoutEmailRequired',
        message: 'Add your PayPal Sandbox payout email before accepting this project.',
      };
    }

    const now = new Date();
    const userUpdates: Partial<typeof users.$inferInsert> = {
      lastWorkspace: 'freelancer',
    };
    if (suppliedPaypal && suppliedPaypal !== user.payoutPaypalEmail?.toLowerCase()) {
      userUpdates.payoutPaypalEmail = suppliedPaypal;
      userUpdates.payoutEmailChangedAt = now;
    }

    await db.update(users).set(userUpdates).where(eq(users.id, user.userId));

    const [updatedProject] = await db
      .update(projects)
      .set({
        freelancerId: user.userId,
        freelancerPaypalEmail: finalPaypalEmail,
        updatedAt: now,
      })
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      return {
        ok: false,
        status: 404,
        error: 'NotFound',
        message: 'Project not found.',
      };
    }

    await db
      .update(invites)
      .set({
        usedCount: invite.usedCount + 1,
        acceptedBy: user.userId,
        acceptedAt: now,
      })
      .where(eq(invites.id, invite.id));

    await db.insert(activity).values({
      id: `act_${randomUUID().slice(0, 8)}`,
      projectId: updatedProject.id,
      actor: 'freelancer',
      kind: 'invite_accepted',
      text: `${user.name} accepted the project invitation.`,
      meta: {
        inviteId: invite.id,
        freelancerId: user.userId,
        paypalEmail: finalPaypalEmail,
      },
    });

    return {
      ok: true,
      project: {
        id: updatedProject.id,
        title: updatedProject.title,
      },
      paypalEmail: finalPaypalEmail,
    };
  }
}
