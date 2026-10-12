import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.service';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async list(userId: number) {
    const items = await this.prisma.cart.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: {
        sku: {
          include: {
            product: {
              select: { id: true, name: true, mainImage: true, status: true, deletedAt: true },
            },
            specValues: {
              include: { specValue: { include: { group: { select: { name: true } } } } },
            },
          },
        },
      },
    });

    return items.map((i) => ({
      id: i.id,
      skuId: i.skuId,
      productId: i.sku.product.id,
      name: i.sku.product.name,
      image: this.storage.toPublicUrl(i.sku.image ?? i.sku.product.mainImage),
      spec: i.sku.specValues
        .map((sv) => `${sv.specValue.group.name}:${sv.specValue.value}`)
        .join(' / '),
      price: i.sku.price,
      stock: i.sku.stock,
      quantity: i.quantity,
      selected: i.selected,
      onSale: i.sku.status === 1 && i.sku.product.status === 1 && i.sku.product.deletedAt == null,
    }));
  }

  async add(userId: number, dto: AddCartItemDto) {
    const sku = await this.prisma.productSku.findUnique({ where: { id: dto.skuId } });
    if (!sku) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 'SKU 不存在');
    }
    const quantity = dto.quantity ?? 1;
    const existing = await this.prisma.cart.findUnique({
      where: { userId_skuId: { userId, skuId: dto.skuId } },
    });
    if (existing) {
      await this.prisma.cart.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity, selected: 1 },
      });
    } else {
      await this.prisma.cart.create({ data: { userId, skuId: dto.skuId, quantity, selected: 1 } });
    }
    return null;
  }

  async update(userId: number, id: number, dto: UpdateCartItemDto) {
    await this.ensureOwn(userId, id);
    await this.prisma.cart.update({ where: { id }, data: dto });
    return null;
  }

  async remove(userId: number, id: number) {
    await this.ensureOwn(userId, id);
    await this.prisma.cart.delete({ where: { id } });
    return null;
  }

  private async ensureOwn(userId: number, id: number) {
    const item = await this.prisma.cart.findUnique({ where: { id } });
    if (!item || item.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '购物车条目不存在');
    }
    return item;
  }
}
