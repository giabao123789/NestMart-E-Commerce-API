import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';

// ─── Create DTO ──────────────────────────────────────────────────────────────
export class CreateCategoryDto {
  @ApiProperty({
    description: 'Tên danh mục — slug sẽ được tự động tạo từ tên này',
    example: 'Điện Thoại & Phụ Kiện',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả danh mục',
    example: 'Các sản phẩm điện thoại và phụ kiện chính hãng',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// ─── Update DTO ───────────────────────────────────────────────────────────────
// PartialType: tất cả field của CreateCategoryDto trở thành optional
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}