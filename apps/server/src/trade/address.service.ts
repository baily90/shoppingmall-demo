import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@mall/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: number) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });
  }

  async create(userId: number, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.userAddress.count({ where: { userId } });
      // 第一条地址自动设为默认；显式设为默认时先把其它地址取消默认
      const isDefault = dto.isDefault === 1 || count === 0 ? 1 : 0;
      if (isDefault === 1) {
        await tx.userAddress.updateMany({ where: { userId }, data: { isDefault: 0 } });
      }
      return tx.userAddress.create({ data: { userId, ...dto, isDefault } });
    });
  }

  async update(userId: number, id: number, dto: UpdateAddressDto) {
    await this.ensureOwn(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === 1) {
        await tx.userAddress.updateMany({ where: { userId }, data: { isDefault: 0 } });
      }
      return tx.userAddress.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: number, id: number) {
    await this.ensureOwn(userId, id);
    await this.prisma.userAddress.delete({ where: { id } });
    return null;
  }

  private async ensureOwn(userId: number, id: number) {
    const addr = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!addr || addr.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, '地址不存在');
    }
    return addr;
  }
}
