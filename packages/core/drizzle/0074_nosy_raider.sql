ALTER TABLE "latitude"."evaluation_results" ALTER COLUMN "provider_log_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "latitude"."provider_logs" ADD COLUMN "error_id" bigint;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "latitude"."provider_logs" ADD CONSTRAINT "provider_logs_error_id_run_errors_id_fk" FOREIGN KEY ("error_id") REFERENCES "latitude"."run_errors"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_idx" ON "latitude"."provider_logs" USING btree ("error_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_idx" ON "latitude"."provider_logs" USING btree ("provider_id");