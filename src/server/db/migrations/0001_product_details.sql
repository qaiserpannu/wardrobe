CREATE TYPE "public"."product_occasion" AS ENUM('casual', 'formal', 'party', 'festive', 'wedding', 'bridal');--> statement-breakpoint
CREATE TYPE "public"."product_stitching" AS ENUM('stitched', 'unstitched');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fabric" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pieces" smallint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stitching" "product_stitching";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "occasion" "product_occasion";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "imperfections" text;--> statement-breakpoint
-- The search column is rebuilt so that fabric is searchable. It must come after
-- the fabric column exists, and its index has to be created again.
ALTER TABLE "products" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("products"."name", '') || ' ' || coalesce("products"."description", '') || ' ' || coalesce("products"."brand", '') || ' ' || coalesce("products"."color", '') || ' ' || coalesce("products"."fabric", ''))) STORED;--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin ("search_vector");
