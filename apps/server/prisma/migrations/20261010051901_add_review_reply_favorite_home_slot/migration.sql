-- AlterTable
ALTER TABLE "product_review" ADD COLUMN     "reply_admin_id" INTEGER,
ADD COLUMN     "reply_at" TIMESTAMP(3),
ADD COLUMN     "reply_content" TEXT;

-- CreateTable
CREATE TABLE "product_favorite" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_slot" (
    "id" SERIAL NOT NULL,
    "type" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "link_type" INTEGER NOT NULL DEFAULT 0,
    "link_value" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_favorite_user_id_idx" ON "product_favorite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_favorite_user_id_product_id_key" ON "product_favorite"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "home_slot_type_status_sort_idx" ON "home_slot"("type", "status", "sort");

-- AddForeignKey
ALTER TABLE "product_favorite" ADD CONSTRAINT "product_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_favorite" ADD CONSTRAINT "product_favorite_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
