import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcrypt';

// ─── Enum định nghĩa các role trong hệ thống ─────────────────────────
// Enum được lưu vào DB dưới dạng string 'admin' hoặc 'user'
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// @Entity('users'): class này ánh xạ tới bảng 'users' trong PostgreSQL
// Khi synchronize:true (development), TypeORM tự tạo bảng này
@Entity('users')
export class UserEntity {
  // ─── Primary Key ───────────────────────────────────────────────────
  // uuid: tự generate UUID v4 (ví dụ: '550e8400-e29b-41d4-a716-446655440000')
  // Dùng UUID thay auto-increment integer vì:
  // - Không đoán được ID tiếp theo (bảo mật hơn)
  // - Dễ merge data từ nhiều DB khi scale
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Columns cơ bản ────────────────────────────────────────────────
  @Column({ length: 100 })
  name: string;

  // unique: true → PostgreSQL tạo unique constraint, không cho 2 user cùng email
  @Column({ unique: true })
  email: string;

  // select: false → field này KHÔNG được trả về trong query mặc định
  // Ví dụ: userRepository.find() → password sẽ KHÔNG có trong kết quả
  // Phải dùng .addSelect('user.password') để lấy thủ công khi cần (login)
  @Column({ select: false })
  @Exclude() // class-transformer: loại bỏ field này khi serialize response
  password: string;

  // type: 'enum': PostgreSQL tạo ENUM type
  // enum: UserRole: các giá trị hợp lệ
  // default: UserRole.USER: giá trị mặc định khi tạo user mới
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  // nullable: true → cho phép null (user chưa có avatar)
  @Column({ nullable: true })
  avatarUrl: string;

  // Lưu hashed refresh token — null khi user đã logout
  // select: false vì đây là data nhạy cảm, không cần trả về client
  @Column({ nullable: true, select: false })
  @Exclude()
  hashedRefreshToken: string;

  // default: true → user mới luôn active
  @Column({ default: true })
  isActive: boolean;

  // ─── Timestamp columns ─────────────────────────────────────────────
  // @CreateDateColumn: TypeORM tự động set khi INSERT
  @CreateDateColumn()
  createdAt: Date;

  // @UpdateDateColumn: TypeORM tự động update mỗi lần UPDATE
  @UpdateDateColumn()
  updatedAt: Date;

  // @DeleteDateColumn: Soft Delete — không xoá thật
  // Khi gọi softDelete() → set deletedAt = now()
  // Query mặc định tự động thêm WHERE deletedAt IS NULL
  @DeleteDateColumn()
  deletedAt: Date;

  // ─── Lifecycle Hooks ───────────────────────────────────────────────
  // @BeforeInsert: chạy TRƯỚC khi INSERT vào DB
  // Tự động hash password trước khi lưu → không bao giờ lưu plain text password
  @BeforeInsert()
  async hashPasswordBeforeInsert() {
    if (this.password) {
      // bcrypt.hash: hash password với salt rounds = 10
      // Salt rounds càng cao → càng an toàn nhưng càng chậm
      // 10 là giá trị cân bằng tốt cho production
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  // @BeforeUpdate: chạy TRƯỚC khi UPDATE
  // Nếu password được thay đổi → hash lại
  @BeforeUpdate()
  async hashPasswordBeforeUpdate() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}