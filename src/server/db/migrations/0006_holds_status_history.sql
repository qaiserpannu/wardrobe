CREATE TYPE "public"."hold_end_reason" AS ENUM('sold', 'released', 'expired', 'archived');--> statement-breakpoint
CREATE TABLE "product_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_contact" text,
	"note" text,
	"held_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" "hold_end_reason",
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"from_status" "product_status",
	"to_status" "product_status" NOT NULL,
	"admin_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_holds" ADD CONSTRAINT "product_holds_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_holds" ADD CONSTRAINT "product_holds_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_status_events" ADD CONSTRAINT "product_status_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_status_events" ADD CONSTRAINT "product_status_events_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_holds_product_idx" ON "product_holds" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_holds_one_active_idx" ON "product_holds" USING btree ("product_id") WHERE "product_holds"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "product_status_events_product_idx" ON "product_status_events" USING btree ("product_id","created_at");