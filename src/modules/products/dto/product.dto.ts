import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  IsOptional,
  IsUrl,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Create Product DTO ───────────────────────────────────────────────────────
export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro Max 256GB' })
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Điện thoại cao cấp nhất của Apple năm 2024' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Giá sản phẩm (VND)',
    example: 29990000,
    minimum: 0,
  })
  // @IsNumber(): phải là số
  // @IsPositive(): phải > 0
  // @Type(() => Number): class-transformer convert string → number
  // Cần thiết vì form data gửi lên có thể là string
  @IsNumber({}, { message: 'Giá phải là số' })
  @IsPositive({ message: 'Giá phải lớn hơn 0' })
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    description: 'Số lượng tồn kho ban đầu',
    example: 100,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(0, { message: 'Số lượng không được âm' })
  @Type(() => Number)
  stock?: number = 0;

  @ApiPropertyOptional({ example: 'https://example.com/iphone15.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'URL ảnh không hợp lệ' })
  imageUrl?: string;

  @ApiProperty({
    description: 'UUID của danh mục',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  // @IsUUID(): validate phải đúng format UUID
  @IsUUID('4', { message: 'categoryId phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  categoryId: string;
}

// ─── Update Product DTO ───────────────────────────────────────────────────────
export class UpdateProductDto extends PartialType(CreateProductDto) {}

// ─── Query Filter DTO — cho GET /products?... ─────────────────────────────────
export class ProductQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên', example: 'iPhone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Giá tối thiểu', example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Giá tối đa', example: 50000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số item mỗi trang', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sắp xếp theo field',
    enum: ['price', 'name', 'createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'price' | 'name' | 'createdAt' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsString()
  order?: 'ASC' | 'DESC' = 'DESC';
}