import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { FavoriteService } from './favorite.service';
import { PageQueryDto } from '../common/dto/query.dto';

@UseGuards(UserJwtAuthGuard)
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post(':productId')
  add(@CurrentUser() user: UserContext, @Param('productId', ParseIntPipe) productId: number) {
    return this.favoriteService.add(user.id, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: UserContext, @Param('productId', ParseIntPipe) productId: number) {
    return this.favoriteService.remove(user.id, productId);
  }

  @Get()
  list(@CurrentUser() user: UserContext, @Query() query: PageQueryDto) {
    return this.favoriteService.list(user.id, query);
  }

  @Get('status/:productId')
  status(@CurrentUser() user: UserContext, @Param('productId', ParseIntPipe) productId: number) {
    return this.favoriteService.status(user.id, productId);
  }
}
