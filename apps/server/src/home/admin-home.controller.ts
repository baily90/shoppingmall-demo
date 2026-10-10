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
import { HomeService } from './home.service';
import { CreateHomeSlotDto, ListHomeSlotDto, UpdateHomeSlotDto } from './dto/home.dto';

@UseGuards(AdminJwtAuthGuard, PermissionsGuard)
@Controller('admin/home')
export class AdminHomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @Permissions('home:list')
  list(@Query() query: ListHomeSlotDto) {
    return this.homeService.adminList(query);
  }

  @Post()
  @Permissions('home:create')
  create(@Body() dto: CreateHomeSlotDto) {
    return this.homeService.create(dto);
  }

  @Patch(':id')
  @Permissions('home:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHomeSlotDto) {
    return this.homeService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('home:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.homeService.remove(id);
  }
}
