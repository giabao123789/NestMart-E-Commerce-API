import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { UserEntity } from './infrastructure/user.entity';

// @ApiTags: nhóm các endpoint này vào tag 'Users' trong Swagger UI
// @ApiBearerAuth: báo Swagger rằng các route cần JWT token
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
// @Controller('users'): prefix tất cả route trong class này là /users
// Kết hợp với global prefix 'api' và version 'v1' → /api/v1/users
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /api/v1/users/profile ─────────────────────────────────────
  // Lấy profile của user đang đăng nhập
  @Get('profile')
  @ApiOperation({ summary: 'Lấy thông tin profile của mình' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getProfile(@CurrentUser() user: UserEntity): UserEntity {
    // @CurrentUser(): custom param decorator lấy user từ request.user
    // JwtAuthGuard đã verify token và gắn user vào request trước đó
    return user;
  }

  // ─── PATCH /api/v1/users/profile ───────────────────────────────────
  // Cập nhật profile của user đang đăng nhập
  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật profile của mình' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateProfile(
    @CurrentUser('id') userId: string, // chỉ lấy field 'id' từ user object
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.usersService.update(userId, dto);
  }

  // ─── GET /api/v1/users ─────────────────────────────────────────────
  // [ADMIN ONLY] Lấy danh sách tất cả user với pagination
  @Get()
  @Roles(UserRole.ADMIN) // chỉ admin được gọi route này
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  findAll(
    // @Query(): lấy query string từ URL — /users?page=2&limit=5
    // enableImplicitConversion: true trong ValidationPipe tự convert string → number
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.usersService.findAll(page, limit);
  }

  // ─── GET /api/v1/users/:id ─────────────────────────────────────────
  // [ADMIN ONLY] Lấy thông tin user theo ID
  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy thông tin user theo ID' })
  @ApiParam({ name: 'id', description: 'UUID của user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  findOne(
    // ParseUUIDPipe: validate và parse param 'id' phải là UUID hợp lệ
    // Nếu không phải UUID → throw 400 BadRequest ngay, không vào service
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserEntity> {
    return this.usersService.findById(id);
  }

  // ─── PATCH /api/v1/users/:id/toggle-active ─────────────────────────
  // [ADMIN ONLY] Kích hoạt / vô hiệu hoá user
  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Kích hoạt/vô hiệu hoá user' })
  toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserEntity> {
    return this.usersService.toggleActive(id);
  }

  // ─── DELETE /api/v1/users/:id ──────────────────────────────────────
  // [ADMIN ONLY] Soft delete user
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  // @HttpCode: override HTTP status code mặc định
  // DELETE mặc định trả 200, ta muốn 204 No Content (không có body response)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[ADMIN] Xoá user (soft delete)' })
  @ApiResponse({ status: 204, description: 'Xoá thành công' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') requestingUserId: string,
  ): Promise<void> {
    return this.usersService.remove(id, requestingUserId);
  }
}