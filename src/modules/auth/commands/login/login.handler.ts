import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginCommand } from './login.command';
import { UsersService } from '../../../users/users.service';
import { AuthResponseDto, JwtPayload } from '../../dto/auth-response.dto';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async execute(command: LoginCommand): Promise<AuthResponseDto> {
    const { email, password } = command;

    // Tìm user kèm password (select: false nên phải dùng method đặc biệt)
    const user = await this.usersService.findByEmailWithPassword(email);

    // Kiểm tra user tồn tại
    // Dùng message chung chung để tránh username enumeration attack
    // (không để lộ email nào tồn tại, email nào không)
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // So sánh password thô client gửi lên với hash trong DB
    // bcrypt.compare tự salt và so sánh — không thể reverse-engineer
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Kiểm tra tài khoản còn active
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ admin');
    }

    // Tạo JWT tokens
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

    // Cập nhật refresh token trong DB (rotation — xoay vòng token)
    // Mỗi lần login → tạo refresh token mới → hash mới → lưu vào DB
    // Token cũ tự động invalid vì hash trong DB đã thay đổi
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    // Xoá password khỏi object trước khi trả về (dù select:false đã làm rồi)
    // Double protection — đảm bảo password không bao giờ lọt ra response
    delete (user as any).password;

    return { accessToken, refreshToken, user: user as any };
  }
}