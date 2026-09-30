import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AdminOrderController } from './admin-order.controller';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PaymentModule],
  controllers: [AddressController, CartController, OrderController, AdminOrderController],
  providers: [AddressService, CartService, OrderService],
})
export class TradeModule {}
