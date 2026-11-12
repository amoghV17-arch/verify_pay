import crypto from 'node:crypto';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { AppConfig } from '@milestone/shared';
import { getDb } from '../db/index.js';
import { emailOutbox } from '../db/schema.js';
import type { EmailTemplateKind } from './templates.js';

export interface EmailMessage {
  to: string;
  recipientUserId?: string;
  template: EmailTemplateKind;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export interface EmailSendResult {
  id: string;
  deliveredVia: 'outbox' | 'resend' | 'smtp';
  status: string;
  providerId?: string;
}

export interface EmailPort {
  send(msg: EmailMessage): Promise<EmailSendResult>;
}

export function isRealEmailConfigured(config: Pick<AppConfig, 'EMAIL_PROVIDER' | 'RESEND_API_KEY' | 'SMTP_HOST'>): boolean {
  if (config.EMAIL_PROVIDER === 'resend') {
    return Boolean(config.RESEND_API_KEY && config.RESEND_API_KEY.trim().length > 0);
  }
  if (config.EMAIL_PROVIDER === 'smtp') {
    return Boolean(config.SMTP_HOST && config.SMTP_HOST.trim().length > 0);
  }
  return false;
}

async function recordOutbox(
  msg: EmailMessage,
  opts: { deliveredVia: 'outbox' | 'resend' | 'smtp'; status: string; providerId?: string }
): Promise<string> {
  const id = `mail_${crypto.randomUUID()}`;
  try {
    const db = getDb();
    await db.insert(emailOutbox).values({
      id,
      toAddress: msg.to.trim().toLowerCase(),
      recipientUserId: msg.recipientUserId || null,
      template: msg.template,
      subject: msg.subject,
      bodyText: opts.deliveredVia === 'outbox' ? msg.bodyText : `[Sent via ${opts.deliveredVia}]`,
      bodyHtml: opts.deliveredVia === 'outbox' ? msg.bodyHtml : `<p>Delivered via ${opts.deliveredVia}</p>`,
      status: opts.status,
      providerId: opts.providerId || null,
      deliveredVia: opts.deliveredVia,
    });
  } catch {
    // Non-fatal if outbox persistence unavailable during early bootstrap
  }
  return id;
}

class OutboxEmailAdapter implements EmailPort {
  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const id = await recordOutbox(msg, { deliveredVia: 'outbox', status: 'stored' });
    return { id, deliveredVia: 'outbox', status: 'stored' };
  }
}

class ResendEmailAdapter implements EmailPort {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [msg.to],
      subject: msg.subject,
      text: msg.bodyText,
      html: msg.bodyHtml,
    });

    if (error) {
      const id = await recordOutbox(msg, { deliveredVia: 'resend', status: 'failed' });
      return { id, deliveredVia: 'resend', status: 'failed' };
    }

    const providerId = data?.id;
    const id = await recordOutbox(msg, { deliveredVia: 'resend', status: 'sent', providerId });
    return { id, deliveredVia: 'resend', status: 'sent', providerId };
  }
}

class SmtpEmailAdapter implements EmailPort {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>;
  private readonly from: string;

  constructor(config: AppConfig) {
    this.from = config.EMAIL_FROM || 'Milestone <noreply@milestone.local>';
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT || 587,
      secure: (config.SMTP_PORT || 587) === 465,
      auth:
        config.SMTP_USER && config.SMTP_PASS
          ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
          : undefined,
    });
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.bodyText,
        html: msg.bodyHtml,
      });
      const id = await recordOutbox(msg, {
        deliveredVia: 'smtp',
        status: 'sent',
        providerId: info.messageId,
      });
      return { id, deliveredVia: 'smtp', status: 'sent', providerId: info.messageId };
    } catch {
      const id = await recordOutbox(msg, { deliveredVia: 'smtp', status: 'failed' });
      return { id, deliveredVia: 'smtp', status: 'failed' };
    }
  }
}

export function createEmailPort(config: AppConfig): EmailPort {
  if (config.EMAIL_PROVIDER === 'resend' && config.RESEND_API_KEY) {
    return new ResendEmailAdapter(config.RESEND_API_KEY, config.EMAIL_FROM || 'Milestone <noreply@milestone.local>');
  }
  if (config.EMAIL_PROVIDER === 'smtp' && config.SMTP_HOST) {
    return new SmtpEmailAdapter(config);
  }
  return new OutboxEmailAdapter();
}
