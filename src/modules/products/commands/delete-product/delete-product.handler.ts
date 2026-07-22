import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DeleteProductCommand } from './delete-product.command';
import { ProductEntity } from '../../infrastructure/product.entity';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler
  implements ICommandHandler<DeleteProductCommand>
{
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async execute(command: DeleteProductCommand): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: command.id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id: ${command.id}`);
    }

    // softDelete: set deletedAt = now(), không xoá thật
    // Product đã đặt hàng vẫn cần tham chiếu tới → không hard delete
    await this.productRepository.softDelete(command.id);

    // Xoá cache liên quan
    await Promise.all([
      this.cacheManager.del(`products:id:${command.id}`),
      this.cacheManager.del(`products:slug:${product.slug}`),
      this.cacheManager.del('products:list:*'),
    ]);
  }
}
