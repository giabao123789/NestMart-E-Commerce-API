import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CategoryEntity } from './entities/category.entity';

@ApiTags('Categories')
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── POST /api/v1/categories ──────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Tạo danh mục mới' })
  @ApiResponse({ status: 201, type: CategoryEntity })
  @ApiResponse({ status: 409, description: 'Tên danh mục đã tồn tại' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryEntity> {
    return this.categoriesService.create(dto);
  }

  // ─── GET /api/v1/categories ───────────────────────────────────────
  // Public: ai cũng xem được danh sách danh mục
  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy tất cả danh mục (có cache Redis)' })
  findAll(): Promise<CategoryEntity[]> {
    return this.categoriesService.findAll();
  }

  // ─── GET /api/v1/categories/:slug ────────────────────────────────
  // Dùng slug thay vì id → URL đẹp hơn, SEO-friendly hơn
  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Lấy chi tiết danh mục theo slug' })
  @ApiParam({ name: 'slug', example: 'dien-thoai-phu-kien' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy danh mục' })
  findBySlug(@Param('slug') slug: string): Promise<CategoryEntity> {
    return this.categoriesService.findBySlug(slug);
  }

  // ─── PATCH /api/v1/categories/:id ────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Cập nhật danh mục' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryEntity> {
    return this.categoriesService.update(id, dto);
  }

  // ─── DELETE /api/v1/categories/:id ───────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[ADMIN] Xoá danh mục' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}