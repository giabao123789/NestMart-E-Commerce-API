import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from './infrastructure/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    // @InjectRepository(UserEntity): inject Repository<UserEntity> từ TypeORM
    // Repository cung cấp các method: find, findOne, save, update, delete...
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // ─── Tạo user mới ─────────────────────────────────────────────────
  async create(dto: CreateUserDto): Promise<UserEntity> {
    // Kiểm tra email đã tồn tại chưa
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // ConflictException: HTTP 409 — resource đã tồn tại
    if (existing) {
      throw new ConflictException(`Email '${dto.email}' đã được sử dụng`);
    }

    // userRepository.create(): tạo instance UserEntity từ plain object
    // KHÔNG lưu vào DB — chỉ tạo object trong memory
    // @BeforeInsert() hook sẽ tự hash password trước khi save()
    const user = this.userRepository.create(dto);

    // userRepository.save(): INSERT vào DB
    // Lúc này @BeforeInsert() hook chạy → password được hash trước
    return this.userRepository.save(user);
  }

  // ─── Tìm user theo ID ──────────────────────────────────────────────
  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id } });

    // NotFoundException: HTTP 404 — không tìm thấy resource
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id: ${id}`);
    }
    return user;
  }

  // ─── Tìm user theo email (dùng cho auth) ──────────────────────────
  // Dùng QueryBuilder để addSelect password (vì select: false trong Entity)
  async findByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      // addSelect: thêm field password vào SELECT dù có select: false
      // 'user.password': format là 'alias.fieldName'
      .addSelect('user.password')
      .addSelect('user.hashedRefreshToken')
      .where('user.email = :email', { email })
      // andWhere: thêm điều kiện — chỉ lấy user đang active
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
  }

  // ─── Tìm user theo ID kèm refresh token (dùng cho auth) ───────────
  async findByIdWithRefreshToken(id: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.hashedRefreshToken')
      .where('user.id = :id', { id })
      .getOne();
  }

  // ─── Lấy danh sách user (Admin only) ──────────────────────────────
  async findAll(page: number = 1, limit: number = 10) {
    // findAndCount: trả về [data, total] — dùng cho pagination
    const [data, total] = await this.userRepository.findAndCount({
      // skip: bỏ qua bao nhiêu record (offset)
      skip: (page - 1) * limit,
      // take: lấy bao nhiêu record
      take: limit,
      order: { createdAt: 'DESC' }, // mới nhất lên đầu
    });

    return {
      data,
      total,
      page,
      limit,
      // Math.ceil: làm tròn lên — 11 users / 10 per page = 2 pages
      lastPage: Math.ceil(total / limit),
    };
  }

  // ─── Cập nhật thông tin user ───────────────────────────────────────
  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);

    // Object.assign: merge dto vào user entity
    // Chỉ update field có trong dto (PartialType → các field optional)
    Object.assign(user, dto);

    return this.userRepository.save(user);
  }

  // ─── Cập nhật hashed refresh token (dùng nội bộ cho auth) ─────────
  async updateRefreshToken(
    id: string,
    hashedRefreshToken: string | undefined,
  ): Promise<void> {
    // update(): UPDATE trực tiếp không cần load entity trước
    // Nhanh hơn save() vì không cần SELECT rồi mới UPDATE
    await this.userRepository.update(id, { hashedRefreshToken: hashedRefreshToken ?? undefined });
  }

  // ─── Soft delete user (Admin only) ────────────────────────────────
  async remove(id: string, requestingUserId: string): Promise<void> {
    const user = await this.findById(id);

    // Không cho admin tự xoá chính mình
    if (user.id === requestingUserId) {
      throw new ForbiddenException('Không thể tự xoá tài khoản của mình');
    }

    // softDelete: set deletedAt = now() thay vì DELETE thật
    // Query sau này tự động thêm WHERE deletedAt IS NULL
    await this.userRepository.softDelete(id);
  }

  // ─── Kích hoạt / vô hiệu hoá user (Admin only) ────────────────────
  async toggleActive(id: string): Promise<UserEntity> {
    const user = await this.findById(id);
    user.isActive = !user.isActive;
    return this.userRepository.save(user);
  }
}