import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // Đăng ký cả PaymentEntity và OrderEntity
    // PaymentsService cần OrderRepository để validate order trước khi thanh toán
    TypeOrmModule.forFeature([PaymentEntity, OrderEntity]),

    // NotificationsModule: import để dùng EmailProducerService
    // Gửi email xác nhận sau khi thanh toán thành công
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
