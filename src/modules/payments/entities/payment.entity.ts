import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { OrderEntity } from '../../orders/entities/order.entity';

// Enum trạng thái thanh toán
export enum PaymentStatus {
  PENDING = 'pending',   // chờ thanh toán
  SUCCESS = 'success',   // thanh toán thành công
  FAILED = 'failed',     // thanh toán thất bại
  REFUNDED = 'refunded', // đã hoàn tiền
}

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // OneToOne: 1 order có đúng 1 payment record
  // Mỗi đơn hàng chỉ có 1 giao dịch thanh toán tại 1 thời điểm
  @OneToOne(() => OrderEntity, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ name: 'order_id', unique: true })
  orderId: string;

  // amount: số tiền thanh toán
  // Lưu lại để đối chiếu (có thể khác totalAmount nếu có discount sau này)
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  // method: phương thức thanh toán (copy từ order)
  @Column()
  method: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // transactionId: mã giao dịch từ payment gateway
  // nullable vì COD không có transactionId
  // Trong production: đây là ID từ VNPay, Momo, Stripe...
  @Column({ nullable: true })
  transactionId: string;

  // metadata: lưu thêm thông tin từ payment gateway dạng JSON
  // Ví dụ: response code, bank name, card last 4 digits...
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // paidAt: thời điểm thanh toán thành công
  @Column({ nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
