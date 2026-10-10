import { Controller, Get } from '@nestjs/common';
import { HomeService } from './home.service';

/** 商城端公开：首页装修位（轮播图 + 金刚区） */
@Controller('home')
export class StoreHomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('slots')
  slots() {
    return this.homeService.storeSlots();
  }
}
