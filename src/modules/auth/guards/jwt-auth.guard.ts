import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

// AuthGuard('jwt'): Guard built-in của Passport
// Khi canActivate() được gọi → nó chạy JwtStrategy.validate() tự động
// Nếu validate() pass → request đi tiếp, nếu throw → trả về 401
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Inject Reflector để đọc metadata từ decorator
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Bước 1: Kiểm tra route có được đánh dấu @Public() không
    // getAllAndOverride: đọc metadata 'isPublic', ưu tiên method trước rồi mới đến class
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // method handler (ví dụ: findAll)
      context.getClass(),   // controller class (ví dụ: ProductsController)
    ]);

    // Nếu route có @Public() → bỏ qua JWT verify hoàn toàn → cho đi tiếp
    if (isPublic) return true;

    // Bước 2: Không phải @Public() → gọi logic verify JWT của AuthGuard gốc
    // super.canActivate(): chạy JwtStrategy → verify token → gắn user vào request
    return super.canActivate(context);
  }
}