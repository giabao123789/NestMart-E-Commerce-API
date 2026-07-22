import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GetProductQuery } from './get-product.query';
import { ProductEntity } from '../../infrastructure/product.entity';

// Cache chi tiết product lâu hơn danh sách vì ít thay đổi hơn
const PRODUCT_DETAIL_TTL = 600_000; // 10 phút

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async execute(query: GetProductQuery): Promise<ProductEntity> {
    const { slug } = query;
    const cacheKey = `products:slug:${slug}`;

    // Cache-Aside: kiểm tra cache trước
    const cached = await this.cacheManager.get<ProductEntity>(cacheKey);
    if (cached) return cached;

    // Cache MISS → query DB
    // leftJoinAndSelect: JOIN bảng category để lấy thông tin danh mục
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.slug = :slug', { slug })
      .andWhere('product.isActive = :isActive', { isActive: true })
      .getOne();

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với slug: ${slug}`);
    }

    // Lưu vào cache
    await this.cacheManager.set(cacheKey, product, PRODUCT_DETAIL_TTL);

    return product;
  }
}
