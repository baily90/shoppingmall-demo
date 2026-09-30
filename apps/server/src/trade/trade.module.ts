import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentModule } from '../payment/payment.module';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AdminOrderController } from './admin-order.controller';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderProcessor } from './order.processor';
import { ORDER_QUEUE } from './order.constant';

@Module({
  imports: [PaymentModule, BullModule.registerQueue({ name: ORDER_QUEUE })],
  controllers: [AddressController, CartController, OrderController, AdminOrderController],
  providers: [AddressService, CartService, OrderService, OrderProcessor],
})
export class TradeModule {}
