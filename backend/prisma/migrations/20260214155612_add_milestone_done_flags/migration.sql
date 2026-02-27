-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "done_expedition_at" TIMESTAMP(3),
ADD COLUMN     "done_livraison_at" TIMESTAMP(3),
ADD COLUMN     "done_pose_at" TIMESTAMP(3),
ADD COLUMN     "done_production_at" TIMESTAMP(3);
