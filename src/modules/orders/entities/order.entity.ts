import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { UserEntity } from '../../users/infrastructure/user.entity';
import { OrderItemEntity } from './order-item.entity';

// Enum các trạng thái của đơn hàng
// Vòng đời: pending → confirmed → shipping → delivered
//                   ↓
//               cancelled (có thể huỷ khi pending hoặc confirmed)
export enum OrderStatus {
  PENDING = 'pending',       // chờ xác nhận
  CONFIRMED = 'confirmed',   // đã xác nhận
  SHIPPING = 'shipping',     // đang giao hàng
  DELIVERED = 'delivered',   // đã giao thành công
  CANCELLED = 'cancelled',   // đã huỷ
}

// Enum phương thức thanh toán
export enum PaymentMethod {
  COD = 'cod',                      // Cash on Delivery (thanh toán khi nhận hàng)
  BANK_TRANSFER = 'bank_transfer',  // chuyển khoản ngân hàng
  MOCK_CARD = 'mock_card',          // thẻ tín dụng (mock cho demo)
}

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // orderNumber: mã đơn hàng dễ đọc cho user
  // Format: ORD-YYYYMMDD-XXXXX (ví dụ: ORD-20240115-A1B2C)
  // unique: không có 2 đơn hàng cùng mã
  @Column({ unique: true })
  orderNumber: string;

  // ManyToOne: nhiều đơn hàng thuộc về 1 user
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'user_id' })
  userId: string;

  // type: 'enum': PostgreSQL tạo ENUM type trong DB
  // default: PENDING → đơn hàng mới luôn ở trạng thái chờ
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // totalAmount: tổng tiền của đơn hàng
  // Lưu ở đây để tránh phải tính lại mỗi lần query
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  // paymentMethod: phương thức thanh toán user chọn
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.COD,
  })
  paymentMethod: PaymentMethod;

  // isPaid: đã thanh toán chưa
  @Column({ default: false })
  isPaid: boolean;

  // shippingAddress: địa chỉ giao hàng — lưu dạng JSON
  // type: 'jsonb': PostgreSQL JSON binary — query được bên trong
  // Lưu snapshot địa chỉ lúc đặt hàng (user có thể đổi địa chỉ sau)
  @Column({ type: 'jsonb' })
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    ward: string;     // phường/xã
    district: string; // quận/huyện
    city: string;     // tỉnh/thành phố
  };

  @Column({ type: 'text', nullable: true })
  note: string;

  // OneToMany: 1 đơn hàng có nhiều items
  // eager: true → tự load items khi query order
  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItemEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
