import { Controller, Get, Query } from '@nestjs/common';
import { StoreBrandQueryDto } from './dto/brand.dto';
import { BrandService } from './brand.service';

/** 商城端（公开，无鉴权）：品牌列表，只返回启用品牌；可按分类（含后代）过滤 */
@Controller('brands')
export class StoreBrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  list(@Query() query: StoreBrandQueryDto) {
    return this.brandService.listStore(query);
  }
}
