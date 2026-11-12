import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { AppConfig } from '@milestone/shared';
import { formatCents } from '@milestone/shared';
import { getDb } from '../db/index.js';
import {
  milestones,
  notificationPrefs,
  notifications,
  projects,
  users,
} from '../db/schema.js';
import { isRealEmailConfigured, type EmailPort } from '../email/index.js';
import { renderEmailTemplate, type EmailTemplateKind } from '../email/templates.js';
import { sseHub } from './sse.js';

export type NotificationPrefColumn =
  | 'emailInviteAccepted'
  | 'emailFunded'
  | 'emailSubmitted'
  | 'emailReviewed'
  | 'emailReleasePending'
  | 'emailChangesRequested'
  | 'emailPaid';

export interface NotificationDispatchInput {
  userId: string;
  type: string;
  projectId?: string | null;
  milestoneId?: string | null;
  title: string;
  body: string;
  linkUrl: string;
  emailTemplate?: EmailTemplateKind;
  emailPrefKey?: NotificationPrefColumn;
  emailData?: Parameters<typeof renderEmailTemplate>[1];
}

export async function dispatchNotification(
  input: NotificationDispatchInput,
  config?: AppConfig,
  emailPort?: EmailPort
): Promise<void> {
  const db = getDb();
  const id = `notif_${crypto.randomUUID()}`;
  const payload = {
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
  };

  await db.insert(notifications).values({
    id,
    userId: input.userId,
    type: input.type,
    projectId: input.projectId || null,
    milestoneId: input.milestoneId || null,
    payload,
  });

  sseHub.broadcast(`user:${input.userId}`, 'notification.created', {
    id,
    type: input.type,
    projectId: input.projectId || null,
    milestoneId: input.milestoneId || null,
    payload,
    readAt: null,
    createdAt: new Date().toISOString(),
  });

  if (!input.emailTemplate || !config || !emailPort) return;

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user || user.deletedAt) return;

  const canSendEmail = isRealEmailConfigured(config) || user.isDemo || config.NODE_ENV !== 'production';
  if (!canSendEmail) return;

  if (input.emailPrefKey) {
    const [prefs] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, user.id))
      .limit(1);
    if (prefs && prefs[input.emailPrefKey] === false) {
      return;
    }
  }

  const baseUrl = config.APP_BASE_URL.replace(/\/$/, '');
  const fullUrl = input.linkUrl.startsWith('http') ? input.linkUrl : `${baseUrl}${input.linkUrl}`;
  const rendered = renderEmailTemplate(input.emailTemplate, {
    recipientName: user.displayName || user.name,
    actionUrl: fullUrl,
    ...input.emailData,
  });

  await emailPort.send({
    to: user.email,
    recipientUserId: user.id,
    template: input.emailTemplate,
    subject: rendered.subject,
    bodyText: rendered.bodyText,
    bodyHtml: rendered.bodyHtml,
  });
}

let listenerRegistered = false;

export function registerNotificationEventListener(config: AppConfig, emailPort: EmailPort): void {
  if (listenerRegistered) return;
  listenerRegistered = true;

  sseHub.onEvent((projectId, eventName, raw) => {
    if (projectId.startsWith('user:')) return;
    const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    void (async () => {
      try {
        const db = getDb();
        const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!proj) return;

        if (eventName === 'invite.accepted') {
          await dispatchNotification(
            {
              userId: proj.clientId,
              type: 'invite_accepted',
              projectId: proj.id,
              title: 'Freelancer joined project',
              body: `Your invitation for "${proj.title}" was accepted.`,
              linkUrl: `/client/projects/${proj.id}/overview`,
              emailTemplate: 'invite_accepted',
              emailPrefKey: 'emailInviteAccepted',
              emailData: { projectTitle: proj.title },
            },
            config,
            emailPort
          );
          return;
        }

        if (eventName === 'project.funded') {
          const targets = [proj.clientId, proj.freelancerId].filter(
            (id): id is string => Boolean(id)
          );
          const amountFormatted = formatCents(proj.totalCents || 0);
          for (const targetUserId of targets) {
            const rolePath = targetUserId === proj.clientId ? 'client' : 'freelancer';
            await dispatchNotification(
              {
                userId: targetUserId,
                type: 'project_funded',
                projectId: proj.id,
                title: 'Project funded in PayPal Sandbox',
                body: `"${proj.title}" is now funded (${amountFormatted}).`,
                linkUrl: `/${rolePath}/projects/${proj.id}/overview`,
                emailTemplate: 'project_funded',
                emailPrefKey: 'emailFunded',
                emailData: { projectTitle: proj.title, amountFormatted },
              },
              config,
              emailPort
            );
          }
          return;
        }

        if (eventName === 'review.completed') {
          const milestoneId = typeof data.milestoneId === 'string' ? data.milestoneId : null;
          const verdict = typeof data.verdict === 'string' ? data.verdict : 'completed';
          const ms = milestoneId
            ? (await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1))[0]
            : undefined;
          const msName = ms?.name || 'Milestone';

          for (const targetUserId of [proj.clientId, proj.freelancerId].filter(Boolean) as string[]) {
            const isClient = targetUserId === proj.clientId;
            await dispatchNotification(
              {
                userId: targetUserId,
                type: 'review_finished',
                projectId: proj.id,
                milestoneId,
                title: `AI review finished: ${msName}`,
                body: `Verdict for "${msName}": ${verdict.replace(/_/g, ' ')}.`,
                linkUrl: isClient
                  ? `/client/projects/${proj.id}/deliverables${milestoneId ? `/${milestoneId}` : ''}`
                  : `/freelancer/projects/${proj.id}/deliverables`,
                emailTemplate: 'review_finished',
                emailPrefKey: 'emailReviewed',
                emailData: {
                  projectTitle: proj.title,
                  milestoneName: msName,
                  verdictLabel: verdict.replace(/_/g, ' '),
                },
              },
              config,
              emailPort
            );
          }
          return;
        }

        if (eventName === 'milestone.status') {
          const milestoneId = typeof data.milestoneId === 'string' ? data.milestoneId : null;
          const status = typeof data.status === 'string' ? data.status : '';
          if (!milestoneId || !status) return;

          const [ms] = await db
            .select()
            .from(milestones)
            .where(eq(milestones.id, milestoneId))
            .limit(1);
          const msName = ms?.name || 'Milestone';
          const amountFormatted = ms ? formatCents(ms.amountCents) : undefined;

          if (status === 'submitted') {
            await dispatchNotification(
              {
                userId: proj.clientId,
                type: 'deliverable_submitted',
                projectId: proj.id,
                milestoneId,
                title: `Deliverable submitted: ${msName}`,
                body: `A deliverable was submitted for "${msName}" on "${proj.title}".`,
                linkUrl: `/client/projects/${proj.id}/deliverables/${milestoneId}`,
                emailTemplate: 'deliverable_submitted',
                emailPrefKey: 'emailSubmitted',
                emailData: { projectTitle: proj.title, milestoneName: msName },
              },
              config,
              emailPort
            );
          } else if (status === 'approved') {
            await dispatchNotification(
              {
                userId: proj.clientId,
                type: 'needs_decision',
                projectId: proj.id,
                milestoneId,
                title: `Needs your decision: ${msName}`,
                body: `"${msName}" passed review and is awaiting payout release or objection.`,
                linkUrl: `/client/projects/${proj.id}/deliverables/${milestoneId}`,
                emailTemplate: 'needs_decision',
                emailPrefKey: 'emailReleasePending',
                emailData: { projectTitle: proj.title, milestoneName: msName, amountFormatted },
              },
              config,
              emailPort
            );
          } else if (status === 'changes_requested' && proj.freelancerId) {
            await dispatchNotification(
              {
                userId: proj.freelancerId,
                type: 'changes_requested',
                projectId: proj.id,
                milestoneId,
                title: `Changes requested: ${msName}`,
                body: `Revisions were requested for "${msName}" on "${proj.title}".`,
                linkUrl: `/freelancer/projects/${proj.id}/deliverables`,
                emailTemplate: 'changes_requested',
                emailPrefKey: 'emailChangesRequested',
                emailData: { projectTitle: proj.title, milestoneName: msName },
              },
              config,
              emailPort
            );
          } else if (status === 'paid') {
            const targets = [proj.clientId, proj.freelancerId].filter(Boolean) as string[];
            for (const targetUserId of targets) {
              const isClient = targetUserId === proj.clientId;
              await dispatchNotification(
                {
                  userId: targetUserId,
                  type: 'paid',
                  projectId: proj.id,
                  milestoneId,
                  title: `Payout released: ${msName}`,
                  body: `${amountFormatted || 'Payout'} settled in PayPal Sandbox for "${msName}".`,
                  linkUrl: isClient
                    ? `/client/projects/${proj.id}/payments`
                    : `/freelancer/projects/${proj.id}/payments`,
                  emailTemplate: 'paid',
                  emailPrefKey: 'emailPaid',
                  emailData: { projectTitle: proj.title, milestoneName: msName, amountFormatted },
                },
                config,
                emailPort
              );
            }
          }
        }
      } catch {
        // Non-fatal background notification error
      }
    })();
  });
}
