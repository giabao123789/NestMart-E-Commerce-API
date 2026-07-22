import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from '../../products/infrastructure/product.entity';

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ManyToOne: nhiều order items thuộc về 1 order
  @ManyToOne(() => OrderEntity, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ name: 'order_id' })
  orderId: string;

  // ManyToOne: tham chiếu tới product (để xem sản phẩm gốc)
  // nullable: true vì product có thể bị xoá sau khi đặt hàng
  // Nhưng ta vẫn giữ snapshot thông tin bên dưới
  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  // ─── SNAPSHOT fields — rất quan trọng ───────────────────────────────
  // Lưu thông tin sản phẩm TẠI THỜI ĐIỂM đặt hàng
  // Lý do: giá sản phẩm có thể thay đổi sau khi đặt hàng
  // Nếu không lưu snapshot → totalAmount của order sẽ sai khi tính lại
  @Column({ length: 200 })
  productName: string;  // tên sản phẩm lúc đặt

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  productPrice: number; // giá sản phẩm lúc đặt (không bị ảnh hưởng khi giá đổi)

  @Column({ nullable: true })
  productImage: string; // ảnh sản phẩm lúc đặt

  @Column({ type: 'int' })
  quantity: number;

  // subtotal: price * quantity — tính sẵn để tránh tính lại
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @CreateDateColumn()
  createdAt: Date;
}
