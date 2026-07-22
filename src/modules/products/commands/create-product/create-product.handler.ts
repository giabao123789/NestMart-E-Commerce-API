import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateProductCommand } from './create-product.command';
import { ProductEntity } from '../../infrastructure/product.entity';
import { CategoriesService } from '../../../categories/categories.service';
import { ProductCreatedEvent } from '../../events/product-created.event';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler
  implements ICommandHandler<CreateProductCommand>
{
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly categoriesService: CategoriesService,

    // EventBus: bus phát event sau khi command xử lý xong
    // Các EventHandler đăng ký lắng nghe event này
    private readonly eventBus: EventBus,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async execute(command: CreateProductCommand): Promise<ProductEntity> {
    const { name, price, categoryId, description, stock, imageUrl } = command;

    // Validate categoryId có tồn tại không
    // findById sẽ throw NotFoundException nếu không tìm thấy
    await this.categoriesService.findById(categoryId);

    // Tạo và lưu product
    const product = this.productRepository.create({
      name,
      price,
      categoryId,
      description,
      stock: stock ?? 0,
      imageUrl,
    });

    const saved = await this.productRepository.save(product);

    // Xoá cache danh sách products (đã lỗi thời vì có product mới)
    // Pattern-based: xoá tất cả cache key bắt đầu bằng 'products:'
    await this.invalidateProductListCache();

    // Phát ProductCreatedEvent → các Handler khác có thể react
    // Ví dụ: gửi notification cho admin, update search index...
    this.eventBus.publish(new ProductCreatedEvent(saved.id, saved.name, saved.price));

    return saved;
  }

  private async invalidateProductListCache() {
    // Xoá tất cả cache key liên quan đến danh sách products
    // Vì ProductQueryDto có nhiều combination filter → nhiều cache key
    // Cách đơn giản: lưu danh sách cache key, xoá từng cái
    const keys = ['products:list:*'];
    for (const key of keys) {
      await this.cacheManager.del(key);
    }
  }
}
