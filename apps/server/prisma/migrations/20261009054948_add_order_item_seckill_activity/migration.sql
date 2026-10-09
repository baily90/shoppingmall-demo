-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "activity_id" INTEGER;

-- CreateIndex
CREATE INDEX "order_items_activity_id_idx" ON "order_items"("activity_id");
