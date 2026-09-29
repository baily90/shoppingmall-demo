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
import { ProductService } from './product.service';
import {
  CreateProductDto,
  ListProductDto,
  UpdateProductDto,
  UpdateSkuDto,
} from './dto/product.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Permissions('product:list')
  list(@Query() query: ListProductDto) {
    return this.productService.list(query);
  }

  @Get(':id')
  @Permissions('product:list')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.productService.detail(id);
  }

  @Post()
  @Permissions('product:create')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Patch('skus/:skuId')
  @Permissions('product:update')
  updateSku(@Param('skuId', ParseIntPipe) skuId: number, @Body() dto: UpdateSkuDto) {
    return this.productService.updateSku(skuId, dto);
  }

  @Patch(':id')
  @Permissions('product:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('product:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productService.remove(id);
  }
}
