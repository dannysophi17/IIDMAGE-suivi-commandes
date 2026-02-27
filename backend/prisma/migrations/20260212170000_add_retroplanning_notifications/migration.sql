-- CreateEnum
CREATE TYPE "PlanningType" AS ENUM ('AUTO', 'CASUAL');

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "planningType" "PlanningType" NOT NULL DEFAULT 'CASUAL';

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SURVEY', 'PRODUCTION', 'EXPEDITION', 'LIVRAISON', 'POSE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_commandeId_kind_channel_dueAt_key" ON "Notification"("commandeId", "kind", "channel", "dueAt");

-- CreateIndex
CREATE INDEX "Notification_status_dueAt_idx" ON "Notification"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
