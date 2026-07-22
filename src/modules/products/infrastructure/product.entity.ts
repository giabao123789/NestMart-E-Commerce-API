import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { CategoryEntity } from '../../categories/entities/category.entity';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

@Entity('products')
@Index(['name'])
@Index(['categoryId', 'isActive'])
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // type: 'decimal': lưu số thập phân chính xác tránh floating point errors
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  // stock: số lượng tồn kho
  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isActive: boolean;

  // ManyToOne: nhiều product thuộc về 1 category
  // onDelete: 'RESTRICT': không cho xoá category còn product
  @ManyToOne(() => CategoryEntity, (category) => category.products, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column({ name: 'category_id' })
  categoryId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @BeforeInsert()
  generateSlugBeforeInsert() {
    if (this.name) {
      this.slug = `${generateSlug(this.name)}-${Date.now()}`;
    }
  }

  @BeforeUpdate()
  generateSlugBeforeUpdate() {
    if (this.name) {
      this.slug = `${generateSlug(this.name)}-${Date.now()}`;
    }
  }
}