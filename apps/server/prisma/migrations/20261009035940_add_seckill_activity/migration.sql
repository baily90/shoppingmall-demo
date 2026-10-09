-- CreateTable
CREATE TABLE "seckill_activity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seckill_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seckill_activity_sku" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "sku_id" INTEGER NOT NULL,
    "seckill_price" INTEGER NOT NULL,
    "seckill_stock" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seckill_activity_sku_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seckill_activity_sku_sku_id_idx" ON "seckill_activity_sku"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "seckill_activity_sku_activity_id_sku_id_key" ON "seckill_activity_sku"("activity_id", "sku_id");

-- AddForeignKey
ALTER TABLE "seckill_activity_sku" ADD CONSTRAINT "seckill_activity_sku_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "seckill_activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seckill_activity_sku" ADD CONSTRAINT "seckill_activity_sku_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
