import { SetMetadata } from '@nestjs/common';

// Enum định nghĩa các role trong hệ thống
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// ROLES_KEY: key dùng để lưu và đọc metadata
export const ROLES_KEY = 'roles';

// @Roles('admin') → gắn metadata { roles: ['admin'] } vào route
// Guard sẽ đọc metadata này để kiểm tra quyền
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
