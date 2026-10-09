import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../common/guards/admin-jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SeckillService } from './seckill.service';
import {
  CreateSeckillActivityDto,
  ListSeckillActivityDto,
  SeckillSkuDto,
  UpdateSeckillActivityDto,
  UpdateSeckillSkuDto,
} from './dto/seckill.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/seckill')
export class AdminSeckillController {
  constructor(private readonly seckillService: SeckillService) {}

  @Get('activities')
  @Permissions('seckill:list')
  list(@Query() query: ListSeckillActivityDto) {
    return this.seckillService.adminList(query);
  }

  @Get('sku-options')
  @Permissions('seckill:update')
  skuOptions() {
    return this.seckillService.skuOptions();
  }

  @Get('activities/:id')
  @Permissions('seckill:list')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.seckillService.adminDetail(id);
  }

  @Post('activities')
  @Permissions('seckill:create')
  create(@Body() dto: CreateSeckillActivityDto) {
    return this.seckillService.createActivity(dto);
  }

  @Patch('activities/:id')
  @Permissions('seckill:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeckillActivityDto) {
    return this.seckillService.updateActivity(id, dto);
  }

  @Delete('activities/:id')
  @Permissions('seckill:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.seckillService.removeActivity(id);
  }

  @Post('activities/:id/skus')
  @Permissions('seckill:update')
  addSku(@Param('id', ParseIntPipe) id: number, @Body() dto: SeckillSkuDto) {
    return this.seckillService.addSku(id, dto);
  }

  @Patch('activities/:id/skus/:skuId')
  @Permissions('seckill:update')
  updateSku(
    @Param('id', ParseIntPipe) id: number,
    @Param('skuId', ParseIntPipe) skuId: number,
    @Body() dto: UpdateSeckillSkuDto,
  ) {
    return this.seckillService.updateSku(id, skuId, dto);
  }

  @Delete('activities/:id/skus/:skuId')
  @Permissions('seckill:update')
  removeSku(@Param('id', ParseIntPipe) id: number, @Param('skuId', ParseIntPipe) skuId: number) {
    return this.seckillService.removeSku(id, skuId);
  }
}
