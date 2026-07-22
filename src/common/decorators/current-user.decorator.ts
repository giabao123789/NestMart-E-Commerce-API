import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// createParamDecorator: tạo decorator lấy data từ request
// data: tên field muốn lấy — ví dụ @CurrentUser('email') → chỉ lấy email
// ctx: ExecutionContext — truy cập vào request/response
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user; // user được Guard gắn vào request sau khi verify JWT

    // Nếu truyền field cụ thể: @CurrentUser('id') → trả về user.id
    // Nếu không truyền: @CurrentUser() → trả về toàn bộ user object
    return data ? user?.[data] : user;
  },
);
