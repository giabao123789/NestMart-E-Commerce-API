import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../users/infrastructure/user.entity';
import { CartItemEntity } from './cart-item.entity';

@Entity('carts')
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // OneToOne: 1 user có đúng 1 cart — quan hệ 1-1
  // unique constraint trên userId đảm bảo điều này ở tầng DB
  @OneToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' }) // foreign key 'user_id' nằm trong bảng carts
  user: UserEntity;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  // OneToMany: 1 cart có nhiều cart items
  // cascade: true → khi save cart thì tự save items theo
  // eager: true → tự động load items khi query cart (không cần JOIN thủ công)
  @OneToMany(() => CartItemEntity, (item) => item.cart, {
    cascade: true,
    eager: true,
  })
  items: CartItemEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
