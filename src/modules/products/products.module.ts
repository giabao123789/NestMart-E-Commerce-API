import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { ProductEntity } from './infrastructure/product.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesModule } from '../categories/categories.module';

// ─── Command Handlers ─────────────────────────────────────────────────────────
import { CreateProductHandler } from './commands/create-product/create-product.handler';
import { UpdateProductHandler } from './commands/update-product/update-product.handler';
import { DeleteProductHandler } from './commands/delete-product/delete-product.handler';

// ─── Query Handlers ───────────────────────────────────────────────────────────
import { GetProductsHandler } from './queries/get-products/get-products.handler';
import { GetProductHandler } from './queries/get-product/get-product.handler';

// ─── Event Handlers ───────────────────────────────────────────────────────────
import { ProductCreatedHandler } from './events/product-created.handler';

// Tổng hợp tất cả handlers vào mảng để đăng ký gọn hơn
const CommandHandlers = [
  CreateProductHandler,
  UpdateProductHandler,
  DeleteProductHandler,
];

const QueryHandlers = [GetProductsHandler, GetProductHandler];

const EventHandlers = [ProductCreatedHandler];

@Module({
  imports: [
    // TypeOrmModule.forFeature: đăng ký ProductEntity
    // → tạo Repository<ProductEntity> có thể inject bằng @InjectRepository
    TypeOrmModule.forFeature([ProductEntity]),

    // CqrsModule: cung cấp CommandBus, QueryBus, EventBus
    // Bắt buộc phải import ở module nào dùng CQRS
    CqrsModule,

    // CategoriesModule: import để dùng CategoriesService
    // Validate categoryId khi tạo/cập nhật product
    CategoriesModule,

    // CacheModule được đăng ký global trong AppModule
    // → không cần import lại ở đây, chỉ cần @Inject(CACHE_MANAGER)
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
  ],
  // Export ProductsService để CartModule và OrdersModule dùng
  // Ví dụ: validate stock khi thêm vào giỏ hàng
  exports: [ProductsService],
})
export class ProductsModule {}
