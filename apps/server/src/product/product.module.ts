import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { StoreCategoryController } from './store-category.controller';
import { StoreBrandController } from './store-brand.controller';
import { StoreProductController } from './store-product.controller';

@Module({
  controllers: [
    CategoryController,
    BrandController,
    ProductController,
    StoreCategoryController,
    StoreBrandController,
    StoreProductController,
  ],
  providers: [CategoryService, BrandService, ProductService],
})
export class ProductModule {}
