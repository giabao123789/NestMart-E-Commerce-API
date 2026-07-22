import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserRole } from '../infrastructure/user.entity';

// UserResponseDto: định nghĩa chính xác những field nào được trả về client
// Dùng @Expose() thay vì @Exclude() — approach "whitelist" (chỉ expose field được cho phép)
// Đảm bảo password, hashedRefreshToken KHÔNG BAO GIỜ lọt ra ngoài
export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Trần Gia Bảo' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'bao@gmail.com' })
  @Expose()
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  @Expose()
  role: UserRole;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @Expose()
  avatarUrl: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ example: '2024-01-15T08:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T08:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  // password, hashedRefreshToken, deletedAt → KHÔNG có @Expose() → không trả về
}