-- AddColumn
ALTER TABLE "users" ADD COLUMN "accessEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Preserve access for every account created before approval was introduced.
UPDATE "users" SET "accessEnabled" = true;
