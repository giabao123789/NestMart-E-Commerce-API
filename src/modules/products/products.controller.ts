import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from './dto/product.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { ProductEntity } from './infrastructure/product.entity';
import { PaginatedProducts } from './queries/get-products/get-products.handler';

@ApiTags('Products')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── POST /api/v1/products ────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Tạo sản phẩm mới' })
  @ApiResponse({ status: 201, type: ProductEntity })
  @ApiResponse({ status: 404, description: 'Category không tồn tại' })
  create(@Body() dto: CreateProductDto): Promise<ProductEntity> {
    return this.productsService.create(dto);
  }

  // ─── GET /api/v1/products ─────────────────────────────────────────
  // Public route — ai cũng xem được, có cache Redis
  // Hỗ trợ: search, filter theo category, filter theo giá, pagination, sorting
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Lấy danh sách sản phẩm',
    description: 'Hỗ trợ search, filter, pagination và sorting. Có cache Redis 5 phút.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm có pagination' })
  findAll(
    // @Query() lấy toàn bộ query string và map vào ProductQueryDto
    // ValidationPipe tự động validate và transform
    @Query() filters: ProductQueryDto,
  ): Promise<PaginatedProducts> {
    return this.productsService.findAll(filters);
  }

  // ─── GET /api/v1/products/:slug ───────────────────────────────────
  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Lấy chi tiết sản phẩm theo slug' })
  @ApiParam({
    name: 'slug',
    description: 'Slug URL của sản phẩm',
    example: 'iphone-15-pro-max-256gb-1704067200000',
  })
  @ApiResponse({ status: 200, type: ProductEntity })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm' })
  findOne(@Param('slug') slug: string): Promise<ProductEntity> {
    return this.productsService.findBySlug(slug);
  }

  // ─── PATCH /api/v1/products/:id ───────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Cập nhật sản phẩm' })
  @ApiResponse({ status: 200, type: ProductEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductEntity> {
    return this.productsService.update(id, dto);
  }

  // ─── DELETE /api/v1/products/:id ─────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[ADMIN] Xoá sản phẩm (soft delete)' })
  @ApiResponse({ status: 204, description: 'Xoá thành công' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
