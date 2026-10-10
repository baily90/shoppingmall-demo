import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { RedisService } from '../redis/redis.service';
import { CACHE_TTL_SECONDS, homeSlotsKey } from '../common/cache.constant';
import { HomeSlotType } from './home.constant';
import { CreateHomeSlotDto, ListHomeSlotDto, UpdateHomeSlotDto } from './dto/home.dto';

/** 首页装修位：轮播图 + 金刚区（一套 HomeSlot 模型，type 区分），商城端读走 Redis 缓存 */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /** 商城端公开：返回启用的轮播图 + 金刚区（按 sort 升序），Cache Aside 缓存 */
  async storeSlots() {
    const cached = await this.redisService.getJSON<{ banners: unknown[]; navIcons: unknown[] }>(
      homeSlotsKey,
    );
    if (cached) return cached;

    const [banners, navIcons] = await Promise.all([
      this.prisma.homeSlot.findMany({
        where: { type: HomeSlotType.BANNER, status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.homeSlot.findMany({
        where: { type: HomeSlotType.NAV_ICON, status: 1 },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const result = { banners, navIcons };
    await this.redisService.setJSON(homeSlotsKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  // ---------- 管理端 ----------

  async adminList(query: ListHomeSlotDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.HomeSlotWhereInput = {
      type: query.type,
      ...(query.status !== undefined ? { status: query.status } : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.homeSlot.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.homeSlot.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async create(dto: CreateHomeSlotDto) {
    const slot = await this.prisma.homeSlot.create({
      data: {
        type: dto.type,
        name: dto.name,
        image: dto.image,
        linkType: dto.linkType ?? 0,
        linkValue: dto.linkValue ?? null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      },
    });
    await this.redisService.tryDel(homeSlotsKey);
    return slot;
  }

  async update(id: number, dto: UpdateHomeSlotDto) {
    await this.ensure(id);
    const data: Prisma.HomeSlotUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.linkType !== undefined) data.linkType = dto.linkType;
    if (dto.linkValue !== undefined) data.linkValue = dto.linkValue ?? null;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;

    const slot = await this.prisma.homeSlot.update({ where: { id }, data });
    await this.redisService.tryDel(homeSlotsKey);
    return slot;
  }

  async remove(id: number) {
    await this.ensure(id);
    await this.prisma.homeSlot.delete({ where: { id } });
    await this.redisService.tryDel(homeSlotsKey);
    return null;
  }

  private async ensure(id: number) {
    const slot = await this.prisma.homeSlot.findUnique({ where: { id } });
    if (!slot) throw new BusinessException(ErrorCode.NOT_FOUND, '装修位不存在');
    return slot;
  }
}
