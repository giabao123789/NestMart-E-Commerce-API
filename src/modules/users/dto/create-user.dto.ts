import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  // @ApiProperty: Swagger hiển thị field này với description và example
  @ApiProperty({
    description: 'Tên đầy đủ của người dùng',
    example: 'Trần Gia Bảo',
    minLength: 2,
    maxLength: 100,
  })
  // @IsString: phải là string
  // @IsNotEmpty: không được rỗng ('' hoặc '   ' đều bị reject)
  // @MinLength/@MaxLength: giới hạn độ dài
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Tên không được vượt quá 100 ký tự' })
  name: string;

  @ApiProperty({
    description: 'Email đăng nhập — phải là email hợp lệ và chưa được dùng',
    example: 'bao@gmail.com',
  })
  // @IsEmail: kiểm tra format email hợp lệ
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    description:
      'Mật khẩu — ít nhất 8 ký tự, có ít nhất 1 chữ hoa và 1 số',
    example: 'Password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  // @Matches: kiểm tra regex — password phải có ít nhất 1 chữ hoa VÀ 1 số
  // (?=.*[A-Z]): lookahead — chứa ít nhất 1 ký tự viết hoa
  // (?=.*[0-9]): lookahead — chứa ít nhất 1 chữ số
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 số',
  })
  password: string;

  // @ApiPropertyOptional: field không bắt buộc trong Swagger
  // @IsOptional: ValidationPipe bỏ qua validate nếu field không có
  @ApiPropertyOptional({
    description: 'URL ảnh đại diện',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'URL avatar không hợp lệ' })
  avatarUrl?: string;
}