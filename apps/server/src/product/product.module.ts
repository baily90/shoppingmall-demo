import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';

@Module({
  controllers: [CategoryController, BrandController],
  providers: [CategoryService, BrandService],
})
export class ProductModule {}
