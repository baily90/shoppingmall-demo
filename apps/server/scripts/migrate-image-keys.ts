import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * 存量图片地址迁移：把 DB 里写死的绝对 URL（http://host:port/{bucket}/key）归一化成对象 key。
 * 幂等：已是 key / 外部链接的行不会被改写，可重复执行。
 * 与 MinioStorageService.urlToKey 的截断逻辑保持一致（按 /{bucket}/ 边界截断）。
 *
 * 用法：pnpm --filter server migrate:images（需在 migrate deploy 之后、服务重启前执行）。
 */
const prisma = new PrismaClient();

const bucket = process.env.MINIO_BUCKET || 'mall';
const marker = `/${bucket}/`;

function toKey(value: string | null): string | null {
  if (!value) return value;
  const idx = value.indexOf(marker);
  return idx >= 0 ? value.slice(idx + marker.length) : value;
}

/** 单表单字符串列：读全部 → 有变化才写 */
async function migrateColumn(
  delegate: {
    findMany: (args?: unknown) => Promise<Array<Record<string, unknown>>>;
    update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>;
  },
  field: string,
  label: string,
): Promise<void> {
  const rows = await delegate.findMany({ select: { id: true, [field]: true } });
  let changed = 0;
  for (const row of rows) {
    const next = toKey(row[field] as string | null);
    if (next !== row[field]) {
      await delegate.update({ where: { id: row.id as number }, data: { [field]: next } });
      changed++;
    }
  }
  console.log(`[migrate] ${label}: ${changed}/${rows.length} 行改写`);
}

/** ProductReview.images 是 Json[] 的字符串数组，需逐元素变换 */
async function migrateReviewImages(): Promise<void> {
  const rows = await prisma.productReview.findMany({ select: { id: true, images: true } });
  let changed = 0;
  for (const row of rows) {
    const arr = (row.images as string[] | null) ?? [];
    const next = arr.map((v) => toKey(v) as string);
    if (next.some((v, i) => v !== arr[i])) {
      await prisma.productReview.update({ where: { id: row.id }, data: { images: next } });
      changed++;
    }
  }
  console.log(`[migrate] productReview.images: ${changed}/${rows.length} 行改写`);
}

async function main(): Promise<void> {
  await migrateColumn(prisma.adminUser, 'avatar', 'adminUser.avatar');
  await migrateColumn(prisma.user, 'avatar', 'user.avatar');
  await migrateColumn(prisma.category, 'icon', 'category.icon');
  await migrateColumn(prisma.brand, 'logo', 'brand.logo');
  await migrateColumn(prisma.product, 'mainImage', 'product.mainImage');
  await migrateColumn(prisma.productSku, 'image', 'productSku.image');
  await migrateColumn(prisma.productImage, 'url', 'productImage.url');
  await migrateColumn(prisma.orderItem, 'productImage', 'orderItem.productImage');
  await migrateColumn(prisma.homeSlot, 'image', 'homeSlot.image');
  await migrateReviewImages();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
