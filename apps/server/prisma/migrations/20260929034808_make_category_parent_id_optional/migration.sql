-- DropForeignKey
ALTER TABLE "category" DROP CONSTRAINT "category_parent_id_fkey";

-- AlterTable
ALTER TABLE "category" ALTER COLUMN "parent_id" DROP NOT NULL,
ALTER COLUMN "parent_id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
