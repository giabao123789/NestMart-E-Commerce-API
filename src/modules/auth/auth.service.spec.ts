import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../users/infrastructure/user.entity';

// ─── Mock Factory Functions ───────────────────────────────────────────────────
// Tạo mock objects để thay thế dependency thật trong test
// Mỗi method là jest.fn() → có thể setup return value và track calls

const mockCommandBus = () => ({
  execute: jest.fn(),
});

const mockUsersService = () => ({
  findById: jest.fn(),
  updateRefreshToken: jest.fn(),
});

const mockJwtService = () => ({
  signAsync: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn(),
});

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Dữ liệu mock dùng chung trong nhiều test case
const mockUser = {
  id: 'user-uuid-123',
  name: 'Trần Gia Bảo',
  email: 'bao@gmail.com',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

const mockAuthResponse = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  user: mockUser,
};

// ─── Test Suite ───────────────────────────────────────────────────────────────
// describe: nhóm các test liên quan đến AuthService
describe('AuthService', () => {
  let service: AuthService;
  let commandBus: jest.Mocked<ReturnType<typeof mockCommandBus>>;
  let usersService: jest.Mocked<ReturnType<typeof mockUsersService>>;
  let jwtService: jest.Mocked<ReturnType<typeof mockJwtService>>;

  // beforeEach: chạy trước MỖI test case
  // Tạo lại module mới cho mỗi test → đảm bảo test isolation (cô lập)
  beforeEach(async () => {
    // Test.createTestingModule: tạo NestJS module chỉ để test
    // Không boot toàn bộ app — chỉ khởi tạo những gì cần thiết
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService, // service thật cần test

        // Thay thế dependency thật bằng mock objects
        { provide: CommandBus, useFactory: mockCommandBus },
        { provide: UsersService, useFactory: mockUsersService },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    // Lấy instances từ module
    service = module.get<AuthService>(AuthService);
    commandBus = module.get(CommandBus);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  // afterEach: chạy sau mỗi test — reset tất cả mock về trạng thái ban đầu
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Test: AuthService được khởi tạo đúng ─────────────────────────
  it('nên được khởi tạo thành công', () => {
    expect(service).toBeDefined();
  });

  // ─── Test Suite: register() ────────────────────────────────────────
  describe('register()', () => {
    const registerDto: RegisterDto = {
      name: 'Trần Gia Bảo',
      email: 'bao@gmail.com',
      password: 'Password123',
    };

    it('nên đăng ký thành công và trả về tokens + user', async () => {
      // Arrange: setup mock return value
      // commandBus.execute: giả lập RegisterHandler trả về mockAuthResponse
      commandBus.execute.mockResolvedValue(mockAuthResponse);

      // Act: gọi method cần test
      const result = await service.register(registerDto);

      // Assert: kiểm tra kết quả
      expect(result).toEqual(mockAuthResponse);

      // Kiểm tra commandBus.execute được gọi đúng 1 lần
      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      // Kiểm tra được gọi với đúng loại Command
      // expect.objectContaining: object phải chứa ít nhất các field này
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          name: registerDto.name,
          password: registerDto.password,
        }),
      );
    });

    it('nên throw ConflictException khi email đã tồn tại', async () => {
      // Arrange: giả lập CommandBus throw ConflictException
      commandBus.execute.mockRejectedValue(
        new ConflictException('Email đã được sử dụng'),
      );

      // Act & Assert: expect async function throw đúng loại exception
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── Test Suite: login() ───────────────────────────────────────────
  describe('login()', () => {
    const loginDto: LoginDto = {
      email: 'bao@gmail.com',
      password: 'Password123',
    };

    it('nên đăng nhập thành công và trả về tokens', async () => {
      // Arrange
      commandBus.execute.mockResolvedValue(mockAuthResponse);

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result).toEqual(mockAuthResponse);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual(mockUser);
    });

    it('nên throw UnauthorizedException khi sai password', async () => {
      // Arrange: LoginHandler throw UnauthorizedException
      commandBus.execute.mockRejectedValue(
        new UnauthorizedException('Email hoặc mật khẩu không chính xác'),
      );

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      // Kiểm tra message lỗi đúng
      await expect(service.login(loginDto)).rejects.toThrow(
        'Email hoặc mật khẩu không chính xác',
      );
    });

    it('nên throw UnauthorizedException khi email không tồn tại', async () => {
      commandBus.execute.mockRejectedValue(
        new UnauthorizedException('Email hoặc mật khẩu không chính xác'),
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Test Suite: refreshTokens() ──────────────────────────────────
  describe('refreshTokens()', () => {
    it('nên tạo tokens mới thành công', async () => {
      // Arrange
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: mockUser,
      };

      usersService.findById.mockResolvedValue(mockUser as any);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')   // lần gọi đầu tiên
        .mockResolvedValueOnce('new-refresh-token');  // lần gọi thứ 2
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await service.refreshTokens('user-uuid-123');

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');

      // Kiểm tra updateRefreshToken được gọi để lưu token mới
      expect(usersService.updateRefreshToken).toHaveBeenCalledTimes(1);
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-uuid-123',
        expect.any(String), // hashed token — không biết chính xác giá trị
      );
    });

    it('nên throw NotFoundException khi userId không tồn tại', async () => {
      // Arrange: findById throw NotFoundException
      usersService.findById.mockRejectedValue(
        new Error('Không tìm thấy user'),
      );

      // Act & Assert
      await expect(service.refreshTokens('invalid-id')).rejects.toThrow();
    });
  });

  // ─── Test Suite: logout() ─────────────────────────────────────────
  describe('logout()', () => {
    it('nên đăng xuất thành công và xoá refresh token', async () => {
      // Arrange
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await service.logout('user-uuid-123');

      // Assert
      expect(result).toEqual({ message: 'Đăng xuất thành công' });

      // Quan trọng: updateRefreshToken phải được gọi với undefined
      // để xoá refresh token khỏi DB
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-uuid-123',
        undefined,
      );
    });
  });
});
