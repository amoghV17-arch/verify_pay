export type EmailTemplateKind =
  | 'verify_email'
  | 'reset_password'
  | 'project_invite'
  | 'invite_accepted'
  | 'project_funded'
  | 'deliverable_submitted'
  | 'review_finished'
  | 'needs_decision'
  | 'paid'
  | 'changes_requested';

export interface RenderedEmail {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapEmailHtml(opts: {
  title: string;
  lead: string;
  detail?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const safeTitle = escapeHtml(opts.title);
  const safeLead = escapeHtml(opts.lead);
  const safeDetail = opts.detail ? `<p style="margin:0 0 20px;color:#5F645C;font-size:15px;line-height:1.55;">${escapeHtml(opts.detail)}</p>` : '';
  const safeCta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background-color:#202722;color:#F5F2EA;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(opts.ctaLabel)}</a></p>`
      : '';

  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background-color:#F5F2EA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#252922;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#FFFFFF;border:1px solid #E6E3DA;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background-color:#202722;padding:20px 24px;color:#F5F2EA;font-size:17px;font-weight:700;letter-spacing:-0.01em;">
        Milestone <span style="font-size:12px;font-weight:500;color:#7CC4B4;margin-left:8px;">Sandbox prototype</span>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px;">
        <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#252922;">${safeTitle}</h1>
        <p style="margin:0 0 16px;color:#252922;font-size:15px;line-height:1.6;">${safeLead}</p>
        ${safeDetail}
        ${safeCta}
        ${
          opts.ctaUrl
            ? `<p style="margin:18px 0 0;font-size:12px;color:#5F645C;word-break:break-all;">Or open this link: ${escapeHtml(opts.ctaUrl)}</p>`
            : ''
        }
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #E6E3DA;background-color:#F5F2EA;font-size:12px;color:#5F645C;">
        Sandbox prototype. No real money moves.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailTemplate(
  kind: EmailTemplateKind,
  data: {
    recipientName?: string;
    actionUrl?: string;
    projectTitle?: string;
    milestoneName?: string;
    amountFormatted?: string;
    inviterName?: string;
    code?: string;
    verdictLabel?: string;
    reason?: string;
  }
): RenderedEmail {
  const greeting = data.recipientName ? `Hi ${data.recipientName},` : 'Hello,';
  const projectLabel = data.projectTitle || 'your project';
  const milestoneLabel = data.milestoneName || 'a milestone';

  switch (kind) {
    case 'verify_email':
      return {
        subject: 'Verify your Milestone email address',
        bodyText: `${greeting}\n\nConfirm your email address for Milestone by visiting:\n${data.actionUrl || ''}\n\nThis link expires in 24 hours.\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'Verify your email address',
          lead: `${greeting} confirm your email address to activate full Milestone workspace actions.`,
          detail: 'This verification link expires in 24 hours.',
          ctaLabel: 'Verify email address',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'reset_password':
      return {
        subject: 'Reset your Milestone password',
        bodyText: `${greeting}\n\nReset your Milestone password using this single-use link:\n${data.actionUrl || ''}\n\nThis link expires in 60 minutes. Changing your password signs out other sessions.\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'Reset your password',
          lead: `${greeting} someone requested a password reset for your Milestone account.`,
          detail: 'This link expires in 60 minutes. If you did not ask to reset your password, you can ignore this message.',
          ctaLabel: 'Choose a new password',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'project_invite':
      return {
        subject: `Invitation to ${projectLabel} on Milestone`,
        bodyText: `${greeting}\n\n${data.inviterName || 'A client'} invited you to "${projectLabel}".\nInvite code: ${data.code || ''}\nOpen invite: ${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: `You are invited to ${projectLabel}`,
          lead: `${data.inviterName || 'A client'} shared a milestone agreement with you for review.`,
          detail: data.code
            ? `Review the acceptance criteria and milestone amounts before accepting. Invite code: ${data.code}`
            : 'Review the acceptance criteria and milestone amounts before accepting.',
          ctaLabel: 'Review invitation',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'invite_accepted':
      return {
        subject: `Invitation accepted for ${projectLabel}`,
        bodyText: `${greeting}\n\nYour invitation for "${projectLabel}" has been accepted. You can now fund the project in PayPal Sandbox.\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'Invitation accepted',
          lead: `Your freelancer accepted the agreement for "${projectLabel}".`,
          detail: 'Next step: fund the project balance in PayPal Sandbox so work can begin.',
          ctaLabel: 'Open project',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'project_funded':
      return {
        subject: `${projectLabel} is funded in PayPal Sandbox`,
        bodyText: `${greeting}\n\n"${projectLabel}" has been funded (${data.amountFormatted || ''}) in PayPal Sandbox.\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'Project funded in PayPal Sandbox',
          lead: `"${projectLabel}" now has ${data.amountFormatted || 'its project budget'} held in the sandbox balance.`,
          ctaLabel: 'View project',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'deliverable_submitted':
      return {
        subject: `Deliverable submitted: ${milestoneLabel}`,
        bodyText: `${greeting}\n\nA deliverable was submitted for "${milestoneLabel}" on "${projectLabel}".\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'New deliverable submitted',
          lead: `Work was submitted for "${milestoneLabel}" on "${projectLabel}" and queued for criteria review.`,
          ctaLabel: 'Inspect review',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'review_finished':
      return {
        subject: `AI review completed: ${milestoneLabel}`,
        bodyText: `${greeting}\n\nAutomated review completed for "${milestoneLabel}" on "${projectLabel}" with verdict: ${data.verdictLabel || 'completed'}.\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: `AI review result: ${data.verdictLabel || 'completed'}`,
          lead: `The acceptance criteria check finished for "${milestoneLabel}" on "${projectLabel}".`,
          ctaLabel: 'View review trace',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'needs_decision':
      return {
        subject: `Action needed: ${milestoneLabel}`,
        bodyText: `${greeting}\n\n"${milestoneLabel}" on "${projectLabel}" passed review and is ready for your decision or scheduled release.\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'Milestone ready for review window',
          lead: `"${milestoneLabel}" on "${projectLabel}" passed criteria checks and needs your attention.`,
          ctaLabel: 'Review milestone',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'changes_requested':
      return {
        subject: `Changes requested: ${milestoneLabel}`,
        bodyText: `${greeting}\n\nChanges were requested for "${milestoneLabel}" on "${projectLabel}".${data.reason ? ` Note: ${data.reason}` : ''}\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'Changes requested on deliverable',
          lead: `"${milestoneLabel}" on "${projectLabel}" needs revisions before payout can be released.`,
          detail: data.reason,
          ctaLabel: 'View feedback',
          ctaUrl: data.actionUrl,
        }),
      };

    case 'paid':
      return {
        subject: `Sandbox payout settled: ${milestoneLabel}`,
        bodyText: `${greeting}\n\n${data.amountFormatted || 'Milestone payout'} was released in PayPal Sandbox for "${milestoneLabel}" on "${projectLabel}".\n${data.actionUrl || ''}\n\nSandbox prototype. No real money moves.`,
        bodyHtml: wrapEmailHtml({
          title: 'PayPal Sandbox payout settled',
          lead: `${data.amountFormatted || 'Funds'} released in PayPal Sandbox for "${milestoneLabel}" on "${projectLabel}".`,
          ctaLabel: 'View settlement ledger',
          ctaUrl: data.actionUrl,
        }),
      };
  }
}

