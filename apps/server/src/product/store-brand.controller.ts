import { Controller, Get, Query } from '@nestjs/common';
import { PageQueryDto } from '../common/dto/query.dto';
import { BrandService } from './brand.service';

/** 商城端（公开，无鉴权）：品牌列表，只返回启用品牌 */
@Controller('brands')
export class StoreBrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  list(@Query() query: PageQueryDto) {
    return this.brandService.list(query, true);
  }
}
