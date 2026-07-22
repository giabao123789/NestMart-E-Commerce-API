import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartEntity } from './entities/cart.entity';
import { CartItemEntity } from './entities/cart-item.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartEntity, CartItemEntity]),
    // Import ProductsModule để dùng ProductsService
    // validate stock khi thêm sản phẩm vào giỏ
    ProductsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  // Export CartService để OrdersModule dùng
  // OrdersService cần lấy cart entity khi tạo order
  exports: [CartService],
})
export class CartModule {}
