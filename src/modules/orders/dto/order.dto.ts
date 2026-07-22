import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod, OrderStatus } from '../entities/order.entity';

// ─── Shipping Address DTO ─────────────────────────────────────────────────────
// Dùng @ValidateNested để validate object lồng bên trong CreateOrderDto
export class ShippingAddressDto {
  @ApiProperty({ example: 'Trần Gia Bảo' })
  @IsString()
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phone: string;

  @ApiProperty({ example: '123 Nguyễn Văn Linh' })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  @MaxLength(200)
  address: string;

  @ApiProperty({ example: 'Phường Tân Phú' })
  @IsString()
  @IsNotEmpty()
  ward: string;

  @ApiProperty({ example: 'Quận 7' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'TP. Hồ Chí Minh' })
  @IsString()
  @IsNotEmpty()
  city: string;
}

// ─── Create Order DTO ─────────────────────────────────────────────────────────
export class CreateOrderDto {
  // @ValidateNested(): validate object lồng ShippingAddressDto
  // @Type(() => ShippingAddressDto): class-transformer convert plain obj → class instance
  // Bắt buộc phải có @Type khi dùng @ValidateNested
  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.COD,
    description: 'Phương thức thanh toán',
  })
  @IsEnum(PaymentMethod, {
    message: `Phương thức thanh toán phải là: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Giao hàng giờ hành chính, gọi trước khi giao',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ─── Update Order Status DTO (Admin only) ─────────────────────────────────────
export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
    description: 'Trạng thái mới của đơn hàng',
  })
  @IsEnum(OrderStatus, {
    message: `Trạng thái phải là: ${Object.values(OrderStatus).join(', ')}`,
  })
  status: OrderStatus;
}

// ─── Query Filter DTO ─────────────────────────────────────────────────────────
export class OrderQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
