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
import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@UseGuards(UserJwtAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  list(@CurrentUser() user: UserContext) {
    return this.addressService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateAddressDto) {
    return this.addressService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserContext, @Param('id', ParseIntPipe) id: number) {
    return this.addressService.remove(user.id, id);
  }
}
