import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RegisterHandler } from './commands/register/register.handler';
import { LoginHandler } from './commands/login/login.handler';

// Danh sách tất cả Command Handlers của Auth module
// Đăng ký vào providers để NestJS nhận biết và inject được
const CommandHandlers = [RegisterHandler, LoginHandler];

@Module({
  imports: [
    // CqrsModule: cung cấp CommandBus, QueryBus, EventBus
    // Bắt buộc phải import để dùng @CommandHandler, @QueryHandler
    CqrsModule,

    // UsersModule: import để dùng UsersService (đã export từ UsersModule)
    UsersModule,

    // JwtModule: cung cấp JwtService để sign và verify JWT
    // registerAsync: cấu hình bất đồng bộ, cần inject ConfigService
    JwtModule.register({}),
    // Không set secret/expiresIn ở đây vì mỗi token type dùng secret khác nhau
    // Ta sẽ truyền secret/expiresIn trực tiếp khi gọi jwtService.signAsync()
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Strategies: phải là provider để Passport tự động register
    JwtStrategy,
    JwtRefreshStrategy,
    // Command Handlers
    ...CommandHandlers,
  ],
  exports: [
    AuthService,
    JwtStrategy,    // export để AppModule có thể dùng khi setup global guard
  ],
})
export class AuthModule {}