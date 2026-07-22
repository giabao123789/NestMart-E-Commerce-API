import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UpdateProductCommand } from './update-product.command';
import { ProductEntity } from '../../infrastructure/product.entity';
import { CategoriesService } from '../../../categories/categories.service';

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler
  implements ICommandHandler<UpdateProductCommand>
{
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly categoriesService: CategoriesService,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async execute(command: UpdateProductCommand): Promise<ProductEntity> {
    const { id, categoryId, ...rest } = command;

    // Tìm product cần update
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id: ${id}`);
    }

    // Nếu có đổi category → validate category mới có tồn tại không
    if (categoryId && categoryId !== product.categoryId) {
      await this.categoriesService.findById(categoryId);
      product.categoryId = categoryId;
    }

    // Merge các field được cập nhật vào entity
    Object.assign(product, rest);

    const updated = await this.productRepository.save(product);

    // Xoá cache của product này và danh sách products
    await Promise.all([
      this.cacheManager.del(`products:id:${id}`),
      this.cacheManager.del(`products:slug:${product.slug}`),
      this.cacheManager.del('products:list:*'),
    ]);

    return updated;
  }
}
