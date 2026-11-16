CREATE TYPE "public"."visit_kind" AS ENUM('view', 'whatsapp');--> statement-breakpoint
CREATE TABLE "site_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "visit_kind" DEFAULT 'view' NOT NULL,
	"path" text NOT NULL,
	"product_id" uuid,
	"source" text,
	"referrer_host" text,
	"country" text,
	"region" text,
	"city" text,
	"visitor_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_visits_created_idx" ON "site_visits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "site_visits_product_idx" ON "site_visits" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "site_visits_visitor_idx" ON "site_visits" USING btree ("visitor_hash","created_at");