ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "workspace_id" text;
--> statement-breakpoint
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "memory_disclosure_accepted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "memory_policy_updated_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journey_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text,
	"snapshot_type" text NOT NULL,
	"stage" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" integer,
	"source" text DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text,
	"journey_snapshot_id" text,
	"event_type" text NOT NULL,
	"importance" integer DEFAULT 50 NOT NULL,
	"content" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "journey_snapshots"
    ADD CONSTRAINT "journey_snapshots_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "journey_snapshots"
    ADD CONSTRAINT "journey_snapshots_task_id_tasks_id_fk"
    FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "memory_events"
    ADD CONSTRAINT "memory_events_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "memory_events"
    ADD CONSTRAINT "memory_events_task_id_tasks_id_fk"
    FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "memory_events"
    ADD CONSTRAINT "memory_events_journey_snapshot_id_journey_snapshots_id_fk"
    FOREIGN KEY ("journey_snapshot_id") REFERENCES "public"."journey_snapshots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_workspace_id" ON "tasks" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journey_snapshots_workspace_id" ON "journey_snapshots" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journey_snapshots_task_id" ON "journey_snapshots" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journey_snapshots_stage" ON "journey_snapshots" USING btree ("stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journey_snapshots_created_at" ON "journey_snapshots" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_events_workspace_id" ON "memory_events" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_events_task_id" ON "memory_events" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_events_event_type" ON "memory_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memory_events_recorded_at" ON "memory_events" USING btree ("recorded_at");
