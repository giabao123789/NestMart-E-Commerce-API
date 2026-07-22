import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CartEntity } from './cart.entity';
import { ProductEntity } from '../../products/infrastructure/product.entity';

@Entity('cart_items')
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ManyToOne: nhiều cart items thuộc về 1 cart
  // onDelete: CASCADE → khi cart bị xoá thì items cũng bị xoá theo
  @ManyToOne(() => CartEntity, (cart) => cart.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cart_id' })
  cart: CartEntity;

  @Column({ name: 'cart_id' })
  cartId: string;

  // ManyToOne: nhiều cart items có thể trỏ tới cùng 1 product
  // eager: true → tự load product info khi query cart item
  @ManyToOne(() => ProductEntity, { nullable: false, eager: true })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ name: 'product_id' })
  productId: string;

  // quantity: số lượng sản phẩm trong giỏ
  // check: constraint DB đảm bảo quantity luôn > 0
  @Column({
    type: 'int',
    default: 1,
  })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
