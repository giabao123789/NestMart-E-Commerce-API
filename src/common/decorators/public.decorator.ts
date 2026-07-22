import { SetMetadata } from '@nestjs/common';

// IS_PUBLIC_KEY: key để JwtAuthGuard đọc và bỏ qua verify token
export const IS_PUBLIC_KEY = 'isPublic';

// @Public() → route này không cần JWT token
// Ví dụ: GET /products, POST /auth/login, POST /auth/register
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
