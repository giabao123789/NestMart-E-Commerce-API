import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { ProductCreatedEvent } from './product-created.event';

// @EventsHandler: đăng ký handler cho ProductCreatedEvent
// Khi eventBus.publish(new ProductCreatedEvent(...)) được gọi
// → NestJS tự động gọi ProductCreatedHandler.handle()
// Nhiều handler có thể lắng nghe cùng 1 event — không giới hạn
@EventsHandler(ProductCreatedEvent)
export class ProductCreatedHandler
  implements IEventHandler<ProductCreatedEvent>
{
  private readonly logger = new Logger(ProductCreatedHandler.name);

  async handle(event: ProductCreatedEvent): Promise<void> {
    const { productId, productName, price, occurredAt } = event;

    // Hiện tại chỉ log — trong production có thể:
    // - Gửi notification cho admin qua email/Slack
    // - Update Elasticsearch search index
    // - Trigger webhook cho các partner
    // - Ghi vào audit log (nhật ký kiểm tra)
    this.logger.log(
      `✅ Sản phẩm mới được tạo: [${productId}] ${productName} - ${price.toLocaleString('vi-VN')}₫ lúc ${occurredAt.toISOString()}`,
    );
  }
}
