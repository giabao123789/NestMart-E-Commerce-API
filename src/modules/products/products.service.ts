import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProductCommand } from './commands/create-product/create-product.command';
import { UpdateProductCommand } from './commands/update-product/update-product.command';
import { DeleteProductCommand } from './commands/delete-product/delete-product.command';
import { GetProductsQuery } from './queries/get-products/get-products.query';
import { GetProductQuery } from './queries/get-product/get-product.query';

import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { ProductEntity } from './infrastructure/product.entity';
import { PaginatedProducts } from './queries/get-products/get-products.handler';

@Injectable()
export class ProductsService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,

    // Inject repository trực tiếp cho một số thao tác đơn giản
    // không cần đi qua CQRS (ví dụ: findById nội bộ dùng cho cart/order)
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  // ─── Tạo sản phẩm mới — dispatch CreateProductCommand ───────────────
  async create(dto: CreateProductDto): Promise<ProductEntity> {
    return this.commandBus.execute(
      new CreateProductCommand(
        dto.name,
        dto.price,
        dto.categoryId,
        dto.description,
        dto.stock,
        dto.imageUrl,
      ),
    );
  }

  // ─── Lấy danh sách sản phẩm — dispatch GetProductsQuery ─────────────
  async findAll(filters: ProductQueryDto): Promise<PaginatedProducts> {
    return this.queryBus.execute(new GetProductsQuery(filters));
  }

  // ─── Lấy chi tiết sản phẩm theo slug — dispatch GetProductQuery ──────
  async findBySlug(slug: string): Promise<ProductEntity> {
    return this.queryBus.execute(new GetProductQuery(slug));
  }

  // ─── Tìm theo ID (dùng nội bộ cho cart/order) ────────────────────────
  // Không đi qua CQRS vì đây là internal operation (tác vụ nội bộ)
  async findById(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({
      where: { id, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id: ${id}`);
    }
    return product;
  }

  // ─── Cập nhật sản phẩm — dispatch UpdateProductCommand ───────────────
  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    return this.commandBus.execute(
      new UpdateProductCommand(
        id,
        dto.name,
        dto.price,
        dto.categoryId,
        dto.description,
        dto.stock,
        dto.imageUrl,
      ),
    );
  }

  // ─── Xoá sản phẩm — dispatch DeleteProductCommand ────────────────────
  async remove(id: string): Promise<void> {
    return this.commandBus.execute(new DeleteProductCommand(id));
  }

  // ─── Giảm stock khi đặt hàng (dùng trong OrdersService) ─────────────
  // Phải là atomic operation (nguyên tử) → dùng transaction ở OrdersService
  async decreaseStock(id: string, quantity: number): Promise<void> {
    // decrement: UPDATE products SET stock = stock - quantity WHERE id = ...
    // Tránh race condition hơn so với read → modify → write
    await this.productRepository.decrement({ id }, 'stock', quantity);
  }

  // ─── Khôi phục stock khi huỷ đơn hàng ───────────────────────────────
  async increaseStock(id: string, quantity: number): Promise<void> {
    await this.productRepository.increment({ id }, 'stock', quantity);
  }

  // ─── Validate đủ stock để đặt hàng ──────────────────────────────────
  async validateStock(id: string, quantity: number): Promise<ProductEntity> {
    const product = await this.findById(id);

    if (product.stock < quantity) {
      throw new Error(
        `Sản phẩm "${product.name}" chỉ còn ${product.stock} trong kho, không đủ ${quantity} sản phẩm`,
      );
    }

    return product;
  }
}
