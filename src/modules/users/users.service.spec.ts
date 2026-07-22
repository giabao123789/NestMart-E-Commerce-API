import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserEntity, UserRole } from './infrastructure/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// ─── Mock Repository Factory ──────────────────────────────────────────────────
// Tạo mock object có đầy đủ method của TypeORM Repository
// Mỗi method là jest.fn() để có thể setup return value trong từng test
const mockUserRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
  createQueryBuilder: jest.fn(),
});

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockUserEntity: Partial<UserEntity> = {
  id: 'user-uuid-123',
  name: 'Trần Gia Bảo',
  email: 'bao@gmail.com',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

const mockAdminEntity: Partial<UserEntity> = {
  ...mockUserEntity,
  id: 'admin-uuid-456',
  email: 'admin@nestmart.com',
  role: UserRole.ADMIN,
};

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<ReturnType<typeof mockUserRepository>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          // getRepositoryToken(UserEntity): token dùng để inject Repository<UserEntity>
          // Khi test dùng token này → inject mock thay vì real repository
          provide: getRepositoryToken(UserEntity),
          useFactory: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // module.get(token): lấy instance từ DI container
    // Lấy mock repository để setup return value trong test
    userRepository = module.get(getRepositoryToken(UserEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Test: create() ───────────────────────────────────────────────
  describe('create()', () => {
    const createDto: CreateUserDto = {
      name: 'Trần Gia Bảo',
      email: 'bao@gmail.com',
      password: 'Password123',
    };

    it('nên tạo user mới thành công', async () => {
      // Arrange
      // findOne trả về null → email chưa tồn tại
      userRepository.findOne.mockResolvedValue(null);

      // create: trả về entity chưa có id (chưa save vào DB)
      userRepository.create.mockReturnValue(mockUserEntity as UserEntity);

      // save: trả về entity đã có id (đã save vào DB)
      userRepository.save.mockResolvedValue(mockUserEntity as UserEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toEqual(mockUserEntity);

      // Kiểm tra findOne được gọi để check email trùng
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: createDto.email },
      });

      // Kiểm tra create được gọi với đúng data
      expect(userRepository.create).toHaveBeenCalledWith(createDto);

      // Kiểm tra save được gọi để lưu vào DB
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('nên throw ConflictException khi email đã tồn tại', async () => {
      // Arrange: findOne trả về user → email đã tồn tại
      userRepository.findOne.mockResolvedValue(mockUserEntity as UserEntity);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        `Email '${createDto.email}' đã được sử dụng`,
      );

      // Kiểm tra save KHÔNG được gọi khi email trùng
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  // ─── Test: findById() ─────────────────────────────────────────────
  describe('findById()', () => {
    it('nên trả về user khi tìm thấy', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUserEntity as UserEntity);

      // Act
      const result = await service.findById('user-uuid-123');

      // Assert
      expect(result).toEqual(mockUserEntity);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
      });
    });

    it('nên throw NotFoundException khi không tìm thấy user', async () => {
      // Arrange: findOne trả về null → user không tồn tại
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('non-existent-id')).rejects.toThrow(
        'Không tìm thấy user với id: non-existent-id',
      );
    });
  });

  // ─── Test: findAll() ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('nên trả về danh sách user với đúng format pagination', async () => {
      // Arrange
      const mockUsers = [mockUserEntity, mockAdminEntity] as UserEntity[];
      const totalCount = 25;

      // findAndCount trả về tuple [data, total]
      userRepository.findAndCount.mockResolvedValue([mockUsers, totalCount]);

      // Act
      const result = await service.findAll(2, 10); // page=2, limit=10

      // Assert
      expect(result).toEqual({
        data: mockUsers,
        total: totalCount,
        page: 2,
        limit: 10,
        lastPage: 3, // Math.ceil(25/10) = 3
      });

      // Kiểm tra pagination đúng
      expect(userRepository.findAndCount).toHaveBeenCalledWith({
        skip: 10,   // (page-1) * limit = (2-1) * 10 = 10
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });

    it('nên tính lastPage đúng khi total chia hết cho limit', async () => {
      // Arrange: 20 users, 10 per page → 2 pages
      userRepository.findAndCount.mockResolvedValue([[], 20]);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result.lastPage).toBe(2);
    });

    it('nên tính lastPage đúng khi total không chia hết cho limit', async () => {
      // Arrange: 21 users, 10 per page → 3 pages (ceil(21/10) = 3)
      userRepository.findAndCount.mockResolvedValue([[], 21]);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result.lastPage).toBe(3);
    });
  });

  // ─── Test: update() ───────────────────────────────────────────────
  describe('update()', () => {
    const updateDto: UpdateUserDto = { name: 'Tên Mới' };

    it('nên cập nhật user thành công', async () => {
      // Arrange
      const updatedUser = { ...mockUserEntity, name: 'Tên Mới' };
      userRepository.findOne.mockResolvedValue(mockUserEntity as UserEntity);
      userRepository.save.mockResolvedValue(updatedUser as UserEntity);

      // Act
      const result = await service.update('user-uuid-123', updateDto);

      // Assert
      expect(result.name).toBe('Tên Mới');
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('nên throw NotFoundException khi user không tồn tại', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test: remove() ───────────────────────────────────────────────
  describe('remove()', () => {
    it('nên soft delete user thành công', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUserEntity as UserEntity);
      userRepository.softDelete.mockResolvedValue(undefined);

      // Act: xoá user bởi admin (khác userId)
      await service.remove('user-uuid-123', 'admin-uuid-456');

      // Assert: softDelete được gọi với đúng id
      expect(userRepository.softDelete).toHaveBeenCalledWith('user-uuid-123');
    });

    it('nên throw ForbiddenException khi admin tự xoá chính mình', async () => {
      // Arrange: user muốn xoá chính là requestingUser
      userRepository.findOne.mockResolvedValue(mockAdminEntity as UserEntity);

      // Act & Assert: admin-uuid-456 cố xoá chính mình
      await expect(
        service.remove('admin-uuid-456', 'admin-uuid-456'),
      ).rejects.toThrow(ForbiddenException);

      // softDelete KHÔNG được gọi
      expect(userRepository.softDelete).not.toHaveBeenCalled();
    });

    it('nên throw NotFoundException khi user cần xoá không tồn tại', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove('non-existent-id', 'admin-uuid-456'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test: toggleActive() ─────────────────────────────────────────
  describe('toggleActive()', () => {
    it('nên đổi isActive từ true sang false', async () => {
      // Arrange: user đang active
      const activeUser = { ...mockUserEntity, isActive: true };
      const inactiveUser = { ...mockUserEntity, isActive: false };

      userRepository.findOne.mockResolvedValue(activeUser as UserEntity);
      userRepository.save.mockResolvedValue(inactiveUser as UserEntity);

      // Act
      const result = await service.toggleActive('user-uuid-123');

      // Assert
      expect(result.isActive).toBe(false);
    });

    it('nên đổi isActive từ false sang true', async () => {
      // Arrange: user đang inactive
      const inactiveUser = { ...mockUserEntity, isActive: false };
      const activeUser = { ...mockUserEntity, isActive: true };

      userRepository.findOne.mockResolvedValue(inactiveUser as UserEntity);
      userRepository.save.mockResolvedValue(activeUser as UserEntity);

      // Act
      const result = await service.toggleActive('user-uuid-123');

      // Assert
      expect(result.isActive).toBe(true);
    });
  });
});
