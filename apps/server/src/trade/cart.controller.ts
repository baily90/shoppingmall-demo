import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserJwtAuthGuard } from '../common/guards/user-jwt-auth.guard';
import { CurrentUser, UserContext } from '../common/decorators/current-user.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@UseGuards(UserJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  list(@CurrentUser() user: UserContext) {
    return this.cartService.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: UserContext, @Body() dto: AddCartItemDto) {
    return this.cartService.add(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.cartService.remove(user.id, id);
  }
}
