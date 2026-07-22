import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterCommand } from './register.command';
import { UsersService } from '../../../users/users.service';
import { AuthResponseDto, JwtPayload } from '../../dto/auth-response.dto';

// @CommandHandler(RegisterCommand): đăng ký handler này cho RegisterCommand
// Khi commandBus.execute(new RegisterCommand(...)) được gọi
// → NestJS tự động gọi RegisterHandler.execute()
@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // execute(): method bắt buộc của ICommandHandler
  // command: instance của RegisterCommand với data từ controller
  async execute(command: RegisterCommand): Promise<AuthResponseDto> {
    const { name, email, password, avatarUrl } = command;

    // Tạo user mới — UsersService.create() kiểm tra email trùng và hash password
    const user = await this.usersService.create({
      name,
      email,
      password,
      avatarUrl,
    });

    // Tạo JWT payload — thông tin được mã hoá vào token
    const payload: JwtPayload = {
      sub: user.id,       // sub (subject): định danh chính của token
      email: user.email,
      role: user.role,
    };

    // Tạo Access Token và Refresh Token song song (Promise.all để nhanh hơn)
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.accessSecret') as string,
        expiresIn: this.configService.get('jwt.accessExpiresIn') as any, // 15m
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret') as string,
        expiresIn: this.configService.get('jwt.refreshExpiresIn') as any, // 7d
      }),
    ]);

    // Lưu hashed refresh token vào DB
    // Lưu dạng hash (không phải raw token) vì:
    // → Nếu DB bị breach, attacker không dùng được refresh token thật
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
      user: user as any,
    };
  }
}