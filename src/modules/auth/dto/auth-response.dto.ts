import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

// AuthResponseDto: format response khi login/register thành công
export class AuthResponseDto {
  @ApiProperty({
    description: 'Access token — dùng để gọi API (hết hạn sau 15 phút)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token — dùng để lấy access token mới (hết hạn sau 7 ngày)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

// Interface cho JWT payload — dữ liệu được mã hoá vào token
export interface JwtPayload {
  sub: string;        // subject: user ID
  email: string;
  role: string;
  iat?: number;       // issued at: thời điểm tạo token (tự động set bởi JWT)
  exp?: number;       // expiration: thời điểm hết hạn (tự động set bởi JWT)
}