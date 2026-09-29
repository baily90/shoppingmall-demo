import { Controller, Get } from '@nestjs/common';
import { CategoryService } from './category.service';

/** 商城端（公开，无鉴权）：分类树，只返回启用分类 */
@Controller('categories')
export class StoreCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  tree() {
    return this.categoryService.getTree(true);
  }
}
