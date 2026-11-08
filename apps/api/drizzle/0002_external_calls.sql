CREATE TABLE "external_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"service" text NOT NULL,
	"method" text NOT NULL,
	"endpoint_template" text NOT NULL,
	"status" integer,
	"duration_ms" integer NOT NULL,
	"request_id" text,
	"provider_debug_id" text,
	"project_id" text,
	"milestone_id" text,
	"ok" boolean NOT NULL,
	"error_code" text,
	"meta" jsonb
);

