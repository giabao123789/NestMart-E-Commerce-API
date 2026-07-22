// Command: plain object chứa DATA của lệnh — không có logic
// RegisterCommand mang toàn bộ thông tin cần thiết để tạo user mới
// CommandBus.execute(new RegisterCommand(...)) → NestJS tự tìm RegisterHandler
export class RegisterCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly avatarUrl?: string,
  ) {}
}