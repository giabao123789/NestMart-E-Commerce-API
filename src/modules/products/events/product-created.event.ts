// Event: thông báo "điều gì đó đã xảy ra" trong hệ thống
// Khác Command (yêu cầu làm gì đó), Event chỉ mô tả việc đã xảy ra
// Các EventHandler khác nhau có thể subscribe và react theo cách riêng
// Ví dụ: ghi log, gửi notification, update search index, sync cache...
export class ProductCreatedEvent {
  constructor(
    public readonly productId: string,
    public readonly productName: string,
    public readonly price: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
