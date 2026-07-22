import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GetProductsQuery } from './get-products.query';
import { ProductEntity } from '../../infrastructure/product.entity';

// Kiểu trả về của query — pagination result
export interface PaginatedProducts {
  data: ProductEntity[];
  total: number;       // tổng số sản phẩm khớp filter
  page: number;        // trang hiện tại
  limit: number;       // số item mỗi trang
  lastPage: number;    // trang cuối cùng
  hasNextPage: boolean; // còn trang tiếp theo không
}

// TTL cache danh sách products: 5 phút
// Ngắn hơn category vì product thay đổi thường xuyên hơn
const PRODUCTS_LIST_TTL = 300_000;

@QueryHandler(GetProductsQuery)
export class GetProductsHandler implements IQueryHandler<GetProductsQuery> {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async execute(query: GetProductsQuery): Promise<PaginatedProducts> {
    const { filters } = query;
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = filters;

    // Tạo cache key động dựa trên TẤT CẢ filter params
    // JSON.stringify đảm bảo key unique cho mỗi combination filter khác nhau
    // Ví dụ: { search: 'iphone', page: 1 } → key khác với { search: 'samsung', page: 1 }
    const cacheKey = `products:list:${JSON.stringify(filters)}`;

    // Bước 1: kiểm tra cache
    const cached = await this.cacheManager.get<PaginatedProducts>(cacheKey);
    if (cached) return cached;

    // Bước 2: Cache MISS → dùng QueryBuilder để build query linh hoạt
    // QueryBuilder mạnh hơn find() khi cần WHERE điều kiện động
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      // leftJoinAndSelect: JOIN bảng categories và lấy toàn bộ field
      // Dùng để trả về thông tin category cùng với product
      .leftJoinAndSelect('product.category', 'category')
      // Chỉ lấy product đang active và chưa bị soft delete
      .where('product.isActive = :isActive', { isActive: true });

    // ─── Dynamic WHERE conditions ─────────────────────────────────────
    // Chỉ thêm điều kiện nếu có giá trị — tránh WHERE dư thừa

    // Search theo tên — ILIKE: case-insensitive LIKE (PostgreSQL)
    // '%${search}%': tìm chuỗi chứa search ở bất kỳ vị trí nào
    if (search) {
      queryBuilder.andWhere('product.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Filter theo danh mục
    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    // Filter theo khoảng giá
    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // ─── Sorting ──────────────────────────────────────────────────────
    // Whitelist các field được phép sort để tránh SQL injection
    const allowedSortFields = ['price', 'name', 'createdAt'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`product.${safeSortBy}`, order);

    // ─── Pagination ───────────────────────────────────────────────────
    // offset (bỏ qua): (page - 1) * limit
    // Ví dụ: page=3, limit=10 → skip 20 records đầu
    queryBuilder
      .skip((page - 1) * limit)
      .take(limit);

    // getManyAndCount: thực thi query, trả về [data, total]
    // total: tổng số record khớp filter (KHÔNG tính pagination)
    // Dùng để tính lastPage và hasNextPage
    const [data, total] = await queryBuilder.getManyAndCount();

    const result: PaginatedProducts = {
      data,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
    };

    // Bước 3: lưu vào cache
    await this.cacheManager.set(cacheKey, result, PRODUCTS_LIST_TTL);

    return result;
  }
}
