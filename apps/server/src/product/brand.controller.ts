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
import { PageQueryDto } from '../common/dto/query.dto';
import { BrandService } from './brand.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @Permissions('brand:list')
  list(@Query() query: PageQueryDto) {
    return this.brandService.list(query);
  }

  @Post()
  @Permissions('brand:create')
  create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @Patch(':id')
  @Permissions('brand:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('brand:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.brandService.remove(id);
  }
}
