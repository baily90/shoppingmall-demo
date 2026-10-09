-- CreateTable
CREATE TABLE "refund_order" (
    "id" SERIAL NOT NULL,
    "refund_no" TEXT NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" INTEGER NOT NULL DEFAULT 10,
    "logistics_company" TEXT,
    "logistics_no" TEXT,
    "reject_reason" TEXT,
    "refund_transaction_id" TEXT,
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_order_refund_no_key" ON "refund_order"("refund_no");

-- CreateIndex
CREATE INDEX "refund_order_order_id_idx" ON "refund_order"("order_id");

-- CreateIndex
CREATE INDEX "refund_order_user_id_status_idx" ON "refund_order"("user_id", "status");

-- AddForeignKey
ALTER TABLE "refund_order" ADD CONSTRAINT "refund_order_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_order" ADD CONSTRAINT "refund_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 部分唯一索引：一笔订单同一时刻只允许一笔「进行中」的售后（拒绝后可再次申请）
CREATE UNIQUE INDEX "refund_order_one_active_per_order"
  ON "refund_order" ("order_id")
  WHERE "status" IN (10, 20, 30);
