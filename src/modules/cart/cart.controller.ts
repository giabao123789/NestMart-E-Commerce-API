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
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto, CartSummary } from './dto/cart.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Tất cả cart routes đều cần JWT — không có @Public()
// JwtAuthGuard global sẽ tự động protect tất cả routes trong controller này
@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // ─── GET /api/v1/cart ─────────────────────────────────────────────
  // Lấy giỏ hàng của user đang đăng nhập
  @Get()
  @ApiOperation({ summary: 'Lấy giỏ hàng của bạn' })
  @ApiResponse({ status: 200, description: 'Thông tin giỏ hàng đầy đủ' })
  getCart(@CurrentUser('id') userId: string): Promise<CartSummary> {
    return this.cartService.getCart(userId);
  }

  // ─── POST /api/v1/cart/items ──────────────────────────────────────
  // Thêm sản phẩm vào giỏ
  @Post('items')
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ hàng' })
  @ApiResponse({ status: 201, description: 'Giỏ hàng sau khi thêm' })
  @ApiResponse({ status: 400, description: 'Không đủ stock' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại' })
  addToCart(
    @CurrentUser('id') userId: string,
    @Body() dto: AddToCartDto,
  ): Promise<CartSummary> {
    return this.cartService.addToCart(userId, dto);
  }

  // ─── PATCH /api/v1/cart/items/:id ────────────────────────────────
  // Cập nhật số lượng của 1 item trong giỏ
  @Patch('items/:id')
  @ApiOperation({ summary: 'Cập nhật số lượng sản phẩm trong giỏ' })
  @ApiParam({ name: 'id', description: 'UUID của cart item' })
  @ApiResponse({ status: 200, description: 'Giỏ hàng sau khi cập nhật' })
  updateCartItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartSummary> {
    return this.cartService.updateCartItem(userId, itemId, dto);
  }

  // ─── DELETE /api/v1/cart/items/:id ───────────────────────────────
  // Xoá 1 sản phẩm khỏi giỏ
  @Delete('items/:id')
  @ApiOperation({ summary: 'Xoá sản phẩm khỏi giỏ hàng' })
  @ApiParam({ name: 'id', description: 'UUID của cart item' })
  @ApiResponse({ status: 200, description: 'Giỏ hàng sau khi xoá' })
  removeCartItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
  ): Promise<CartSummary> {
    return this.cartService.removeCartItem(userId, itemId);
  }

  // ─── DELETE /api/v1/cart ──────────────────────────────────────────
  // Xoá toàn bộ giỏ hàng
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xoá toàn bộ giỏ hàng' })
  clearCart(
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    return this.cartService.clearCart(userId);
  }
}
