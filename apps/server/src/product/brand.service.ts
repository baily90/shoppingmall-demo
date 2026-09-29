import { Injectable } from '@nestjs/common';
import type { Brand, Prisma } from '@prisma/client';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageQueryDto } from '../common/dto/query.dto';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PageQueryDto, onlyEnabled = false) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const keyword = query.keyword?.trim();
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
      ...(onlyEnabled ? { status: 1 } : {}),
    };

    const [list, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async create(dto: CreateBrandDto) {
    return this.prisma.brand.create({
      data: {
        name: dto.name,
        logo: dto.logo ?? null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      },
      select: { id: true, name: true },
    });
  }

  async update(id: number, dto: UpdateBrandDto) {
    await this.ensureBrand(id);
    const data: Prisma.BrandUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.logo !== undefined) data.logo = dto.logo;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.brand.update({ where: { id }, data, select: { id: true } });
  }

  async remove(id: number) {
    await this.ensureBrand(id);
    const productCount = await this.prisma.product.count({
      where: { brandId: id, deletedAt: null },
    });
    if (productCount > 0) {
      throw new BusinessException(ErrorCode.NOT_ALLOWED, '该品牌下存在商品，无法删除');
    }
    await this.prisma.brand.update({ where: { id }, data: { deletedAt: new Date() } });
    return null;
  }

  private async ensureBrand(id: number): Promise<Brand> {
    const found = await this.prisma.brand.findUnique({ where: { id } });
    if (!found || found.deletedAt) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '品牌不存在');
    }
    return found;
  }
}
