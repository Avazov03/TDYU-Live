-- Certificates: teacher-uploaded file + revocation (additive, nullable).
ALTER TABLE "certificates" ADD COLUMN "file_key" TEXT;
ALTER TABLE "certificates" ADD COLUMN "file_name" TEXT;
ALTER TABLE "certificates" ADD COLUMN "file_mime" TEXT;
ALTER TABLE "certificates" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "certificates" ADD COLUMN "revoked_at" TIMESTAMP(3);
ALTER TABLE "certificates" ADD COLUMN "revoked_by" TEXT;
ALTER TABLE "certificates" ADD COLUMN "revoke_reason" TEXT;
