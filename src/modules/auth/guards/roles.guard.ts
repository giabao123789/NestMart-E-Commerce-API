import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../../../common/decorators/roles.decorator';

// RolesGuard: chạy SAU JwtAuthGuard trong lifecycle
// JwtAuthGuard verify token và gắn user vào request
// RolesGuard đọc user.role từ request và so sánh với @Roles() trên route
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Đọc roles yêu cầu từ metadata của route
    // getAllAndOverride: ưu tiên metadata ở method, fallback về class
    // Ví dụ: @Roles(UserRole.ADMIN) trên method → requiredRoles = ['admin']
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Không có @Roles() decorator → route không yêu cầu role cụ thể → cho qua
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Lấy user từ request (đã được JwtAuthGuard gắn vào trước đó)
    const { user } = context.switchToHttp().getRequest();

    // Kiểm tra user có role phù hợp không
    // some(): trả về true nếu ít nhất 1 role trong requiredRoles khớp với user.role
    const hasRole = requiredRoles.some((role) => user?.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Bạn không có quyền thực hiện hành động này. Yêu cầu role: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}