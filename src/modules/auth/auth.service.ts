import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCommand } from './commands/register/register.command';
import { LoginCommand } from './commands/login/login.command';
import { AuthResponseDto, JwtPayload } from './dto/auth-response.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    // CommandBus: bus điều phối command đến đúng handler
    // commandBus.execute(new XxxCommand()) → tìm @CommandHandler(XxxCommand) → gọi execute()
    private commandBus: CommandBus,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Delegate (uỷ quyền) sang RegisterHandler qua CommandBus
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    return this.commandBus.execute(
      new RegisterCommand(dto.name, dto.email, dto.password, dto.avatarUrl),
    );
  }

  // Delegate sang LoginHandler qua CommandBus
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    return this.commandBus.execute(new LoginCommand(dto.email, dto.password));
  }

  // Refresh tokens: tạo cặp token mới từ refresh token hợp lệ
  // Logic này đơn giản hơn nên để thẳng trong service thay vì tạo Command
  async refreshTokens(userId: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findById(userId);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.accessSecret') as string,
        expiresIn: this.configService.get('jwt.accessExpiresIn') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret') as string,
        expiresIn: this.configService.get('jwt.refreshExpiresIn') as any,
      }),
    ]);

    // Token rotation: mỗi lần refresh → tạo refresh token mới
    // Refresh token cũ tự động bị vô hiệu hoá
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    return { accessToken, refreshToken, user: user as any };
  }

  // Logout: xoá refresh token khỏi DB
  // Sau đó refresh token cũ không dùng được nữa (hash trong DB = null)
  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.updateRefreshToken(userId, undefined);
    return { message: 'Đăng xuất thành công' };
  }
}