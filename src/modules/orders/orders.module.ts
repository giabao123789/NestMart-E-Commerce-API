import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity]),

    // CartModule: import để dùng CartService
    // Lấy cart entity khi tạo order, xoá cart items sau khi đặt hàng
    CartModule,

    // ProductEntity được dùng trực tiếp qua queryRunner.manager
    // nên không cần TypeOrmModule.forFeature([ProductEntity]) ở đây
    // DataSource tự inject được toàn bộ entity
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  // Export để PaymentsModule dùng (cập nhật isPaid sau thanh toán)
  exports: [OrdersService],
})
export class OrdersModule {}
