import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// PartialType: tất cả field của CreateUserDto trở thành optional (?)
// OmitType: loại bỏ field 'password' và 'email' — không cho update qua route này
// Kết hợp 2 cái: UpdateUserDto có name?, avatarUrl? (optional, không có password/email)
//
// Tại sao không cho update email/password ở đây?
// - Email: cần flow riêng với verify email
// - Password: cần flow riêng với verify password cũ
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'email'] as const),
) {}