-- Add favorite flag to Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;
