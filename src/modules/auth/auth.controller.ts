import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/infrastructure/user.entity';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── POST /api/v1/auth/register ────────────────────────────────────
  @Post('register')
  @Public() // không cần JWT — ai cũng đăng ký được
  @HttpCode(HttpStatus.CREATED)
  // Throttle: giới hạn đăng ký để chống tạo account hàng loạt
  @Throttle({ short: { ttl: 60000, limit: 5 } }) // tối đa 5 lần/phút
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  // ─── POST /api/v1/auth/login ───────────────────────────────────────
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK) // 200 OK thay vì 201 Created mặc định của POST
  // Throttle chặt hơn cho login — chống brute force attack
  @Throttle({ short: { ttl: 60000, limit: 5 } }) // tối đa 5 lần/phút
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Sai email hoặc mật khẩu' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  // ─── POST /api/v1/auth/refresh ─────────────────────────────────────
  @Post('refresh')
  @Public() // bypass JwtAuthGuard (access token đã hết hạn)
  // Nhưng dùng AuthGuard('jwt-refresh') riêng để verify refresh token
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth') // Swagger: cần Bearer token (nhưng là refresh token)
  @ApiOperation({
    summary: 'Lấy access token mới bằng refresh token',
    description: 'Gửi Refresh Token trong Authorization header để lấy cặp token mới',
  })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 403, description: 'Refresh token không hợp lệ' })
  refresh(
    // @CurrentUser('id'): lấy user.id từ request.user (JwtRefreshStrategy gắn vào)
    @CurrentUser('id') userId: string,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(userId);
  }

  // ─── POST /api/v1/auth/logout ──────────────────────────────────────
  @Post('logout')
  // Cần JWT hợp lệ để biết logout ai — JwtAuthGuard global sẽ verify
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Đăng xuất — vô hiệu hoá refresh token' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  logout(
    @CurrentUser() user: UserEntity,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.id);
  }

  // ─── POST /api/v1/auth/me ──────────────────────────────────────────
  @Post('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại từ token' })
  getMe(@CurrentUser() user: UserEntity): UserEntity {
    return user;
  }
}