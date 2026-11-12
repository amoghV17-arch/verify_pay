ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_color" text NOT NULL DEFAULT '#337D70';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_workspace" text NOT NULL DEFAULT 'client';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_paypal_email" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_email_changed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "invited_email" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "ip_hash" text,
  "user_agent_summary" text,
  "slot" text,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_tokens_user_id_idx" ON "email_tokens" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "at" timestamp with time zone NOT NULL DEFAULT now(),
  "ip_hash" text,
  "meta" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_user_id_idx" ON "auth_events" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "project_id" text,
  "milestone_id" text,
  "payload" jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_prefs" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_invite_accepted" boolean NOT NULL DEFAULT true,
  "email_funded" boolean NOT NULL DEFAULT true,
  "email_submitted" boolean NOT NULL DEFAULT true,
  "email_reviewed" boolean NOT NULL DEFAULT true,
  "email_release_pending" boolean NOT NULL DEFAULT true,
  "email_changes_requested" boolean NOT NULL DEFAULT true,
  "email_paid" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "to_address" text NOT NULL,
  "recipient_user_id" text,
  "template" text NOT NULL,
  "subject" text NOT NULL,
  "body_text" text NOT NULL,
  "body_html" text NOT NULL,
  "status" text NOT NULL,
  "provider_id" text,
  "delivered_via" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_recipient_idx" ON "email_outbox" ("recipient_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "subject" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_identities_provider_subject_uidx" ON "oauth_identities" ("provider", "subject");

