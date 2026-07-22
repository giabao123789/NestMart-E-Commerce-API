// RegisterDto hoàn toàn giống CreateUserDto
// Tạo alias riêng để:
// 1. Swagger hiển thị tên đẹp hơn (RegisterDto thay vì CreateUserDto)
// 2. Sau này có thể thêm field riêng cho registration (referralCode, agreeTerms...)
// mà không ảnh hưởng đến CreateUserDto dùng ở chỗ khác
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {}