import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

// Hàm tạo slug từ tên tiếng Việt
// Slug: chuỗi URL-friendly, ví dụ "Điện Tử" → "dien-tu"
// Dùng trong URL: /categories/dien-tu thay vì /categories/123
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')                    // tách ký tự có dấu thành base + dấu riêng
    .replace(/[\u0300-\u036f]/g, '')     // xoá các dấu (combining marks)
    .replace(/đ/g, 'd')                  // xử lý riêng chữ đ
    .replace(/[^a-z0-9\s-]/g, '')        // xoá ký tự đặc biệt
    .replace(/\s+/g, '-')               // thay khoảng trắng bằng gạch ngang
    .replace(/-+/g, '-')                // loại bỏ gạch ngang liên tiếp
    .trim();
}

@Entity('categories')
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // unique: true → không có 2 danh mục cùng tên
  @Column({ unique: true })
  name: string;

  // slug: URL-friendly version của name
  // unique: true → mỗi slug chỉ xuất hiện 1 lần → URL luôn unique
  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationship: 1 category có nhiều product
  // Lazy import ProductEntity bằng () => để tránh circular dependency
  // ProductEntity cũng import CategoryEntity → nếu import thẳng sẽ lỗi circular
  @OneToMany('ProductEntity', 'category')
  products: any[];

  // @BeforeInsert: tự động tạo slug từ name trước khi INSERT
  @BeforeInsert()
  generateSlugBeforeInsert() {
    if (this.name) {
      this.slug = generateSlug(this.name);
    }
  }

  // @BeforeUpdate: cập nhật slug nếu name thay đổi
  @BeforeUpdate()
  generateSlugBeforeUpdate() {
    if (this.name) {
      this.slug = generateSlug(this.name);
    }
  }
}