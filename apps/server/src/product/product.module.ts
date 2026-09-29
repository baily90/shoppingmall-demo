import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  controllers: [CategoryController, BrandController, ProductController],
  providers: [CategoryService, BrandService, ProductService],
})
export class ProductModule {}
