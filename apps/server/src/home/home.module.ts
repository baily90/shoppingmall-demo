import { Module } from '@nestjs/common';
import { HomeService } from './home.service';
import { StoreHomeController } from './store-home.controller';
import { AdminHomeController } from './admin-home.controller';

@Module({
  controllers: [StoreHomeController, AdminHomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}
