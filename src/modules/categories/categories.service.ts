import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

// Cache keys tập trung ở 1 chỗ → dễ maintain, không bị typo
// Nếu đổi tên key sau này chỉ cần sửa 1 chỗ
const CACHE_KEYS = {
  ALL_CATEGORIES: 'categories:all',
  CATEGORY_BY_SLUG: (slug: string) => `categories:slug:${slug}`,
  CATEGORY_BY_ID: (id: string) => `categories:id:${id}`,
};

// TTL (Time To Live): 10 phút = 600 giây = 600_000 milliseconds
// Category ít thay đổi → có thể cache lâu hơn product
const CACHE_TTL = 600_000;

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,

    // @Inject(CACHE_MANAGER): inject Cache instance từ @nestjs/cache-manager
    // CACHE_MANAGER là token (định danh) mà CacheModule đăng ký
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // ─── Tạo danh mục mới (Admin only) ─────────────────────────────────
  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    // Kiểm tra tên đã tồn tại chưa
    const existing = await this.categoryRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Danh mục '${dto.name}' đã tồn tại`);
    }

    const category = this.categoryRepository.create(dto);
    const saved = await this.categoryRepository.save(category);

    // Cache Invalidation: xoá cache danh sách sau khi thêm mới
    // → lần sau GET /categories sẽ query DB lại và có category mới
    await this.cacheManager.del(CACHE_KEYS.ALL_CATEGORIES);

    return saved;
  }

  // ─── Lấy tất cả danh mục (Public, có cache) ─────────────────────────
  async findAll(): Promise<CategoryEntity[]> {
    // Cache-Aside Pattern:
    // Bước 1: kiểm tra cache trước
    const cached = await this.cacheManager.get<CategoryEntity[]>(
      CACHE_KEYS.ALL_CATEGORIES,
    );

    if (cached) {
      // Cache HIT → trả về ngay, không query DB
      return cached;
    }

    // Bước 2: Cache MISS → query DB
    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' }, // sắp xếp theo tên A-Z
    });

    // Bước 3: lưu vào cache với TTL 10 phút
    await this.cacheManager.set(CACHE_KEYS.ALL_CATEGORIES, categories, CACHE_TTL);

    return categories;
  }

  // ─── Tìm danh mục theo slug (Public, có cache) ───────────────────────
  async findBySlug(slug: string): Promise<CategoryEntity> {
    const cacheKey = CACHE_KEYS.CATEGORY_BY_SLUG(slug);
    const cached = await this.cacheManager.get<CategoryEntity>(cacheKey);

    if (cached) return cached;

    const category = await this.categoryRepository.findOne({
      where: { slug, isActive: true },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với slug: ${slug}`);
    }

    await this.cacheManager.set(cacheKey, category, CACHE_TTL);
    return category;
  }

  // ─── Tìm danh mục theo ID (dùng nội bộ) ────────────────────────────
  async findById(id: string): Promise<CategoryEntity> {
    const cacheKey = CACHE_KEYS.CATEGORY_BY_ID(id);
    const cached = await this.cacheManager.get<CategoryEntity>(cacheKey);
    if (cached) return cached;

    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với id: ${id}`);
    }

    await this.cacheManager.set(cacheKey, category, CACHE_TTL);
    return category;
  }

  // ─── Cập nhật danh mục (Admin only) ─────────────────────────────────
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const category = await this.findById(id);

    // Kiểm tra tên mới có trùng với category khác không
    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoryRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`Tên danh mục '${dto.name}' đã được sử dụng`);
      }
    }

    Object.assign(category, dto);
    const updated = await this.categoryRepository.save(category);

    // Xoá tất cả cache liên quan đến category này
    await Promise.all([
      this.cacheManager.del(CACHE_KEYS.ALL_CATEGORIES),
      this.cacheManager.del(CACHE_KEYS.CATEGORY_BY_SLUG(category.slug)),
      this.cacheManager.del(CACHE_KEYS.CATEGORY_BY_ID(id)),
    ]);

    return updated;
  }

  // ─── Xoá danh mục (Admin only) ───────────────────────────────────────
  async remove(id: string): Promise<void> {
    const category = await this.findById(id);

    // Hard delete cho category (không có softDelete)
    // Lý do: category không có dữ liệu lịch sử quan trọng như order
    await this.categoryRepository.remove(category);

    // Xoá cache
    await Promise.all([
      this.cacheManager.del(CACHE_KEYS.ALL_CATEGORIES),
      this.cacheManager.del(CACHE_KEYS.CATEGORY_BY_SLUG(category.slug)),
      this.cacheManager.del(CACHE_KEYS.CATEGORY_BY_ID(id)),
    ]);
  }
}