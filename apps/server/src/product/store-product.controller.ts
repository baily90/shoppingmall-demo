import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ListProductDto } from './dto/product.dto';
import { ProductService } from './product.service';

/** 商城端（公开，无鉴权）：商品列表/详情，只出上架商品 */
@Controller('products')
export class StoreProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@Query() query: ListProductDto) {
    return this.productService.listOnSale(query);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.productService.detail(id, true);
  }
}
