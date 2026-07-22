import {
  IsUUID,
  IsInt,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Thêm sản phẩm vào giỏ ───────────────────────────────────────────────────
export class AddToCartDto {
  @ApiProperty({
    description: 'UUID của sản phẩm muốn thêm vào giỏ',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'productId phải là UUID hợp lệ' })
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Số lượng muốn thêm',
    example: 2,
    minimum: 1,
    maximum: 100,
  })
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải ít nhất là 1' })
  @Max(100, { message: 'Số lượng tối đa là 100 mỗi lần thêm' })
  @Type(() => Number)
  quantity: number;
}

// ─── Cập nhật số lượng item trong giỏ ────────────────────────────────────────
export class UpdateCartItemDto {
  @ApiProperty({
    description: 'Số lượng mới',
    example: 3,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1, { message: 'Số lượng phải ít nhất là 1. Muốn xoá hãy dùng DELETE.' })
  @Max(100)
  @Type(() => Number)
  quantity: number;
}

// ─── Response DTO cho Cart ────────────────────────────────────────────────────
// Interface thay vì class vì chỉ dùng để type response, không cần validate
export interface CartSummary {
  id: string;
  userId: string;
  items: CartItemSummary[];
  totalItems: number;    // tổng số loại sản phẩm
  totalQuantity: number; // tổng số lượng tất cả sản phẩm
  totalPrice: number;    // tổng giá trị giỏ hàng
}

export interface CartItemSummary {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  quantity: number;
  subtotal: number; // subtotal (giá tạm tính): price * quantity
}
