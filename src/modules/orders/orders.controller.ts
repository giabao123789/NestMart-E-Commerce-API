import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
} from './dto/order.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { UserEntity } from '../users/infrastructure/user.entity';
import { OrderEntity } from './entities/order.entity';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ─── POST /api/v1/orders ──────────────────────────────────────────
  // Đặt hàng từ giỏ hàng hiện tại
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Đặt hàng từ giỏ hàng',
    description:
      'Tạo đơn hàng từ toàn bộ sản phẩm trong giỏ. ' +
      'Tự động trừ stock và xoá giỏ hàng trong 1 transaction.',
  })
  @ApiResponse({ status: 201, type: OrderEntity })
  @ApiResponse({ status: 400, description: 'Giỏ hàng rỗng hoặc không đủ stock' })
  createOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderEntity> {
    return this.ordersService.createOrder(userId, dto);
  }

  // ─── GET /api/v1/orders ───────────────────────────────────────────
  // Lấy danh sách đơn hàng của user đang đăng nhập
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng của bạn' })
  findMyOrders(
    @CurrentUser('id') userId: string,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findMyOrders(userId, query);
  }

  // ─── GET /api/v1/orders/admin/all ────────────────────────────────
  // [ADMIN] Lấy tất cả đơn hàng trong hệ thống
  // Đặt TRƯỚC route :id để không bị hiểu nhầm 'admin' là UUID
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy tất cả đơn hàng' })
  findAllOrders(@Query() query: OrderQueryDto) {
    return this.ordersService.findAllOrders(query);
  }

  // ─── GET /api/v1/orders/:id ───────────────────────────────────────
  // Lấy chi tiết đơn hàng — user chỉ xem được đơn của mình
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết đơn hàng' })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem đơn hàng này' })
  findOne(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: UserEntity,
  ): Promise<OrderEntity> {
    return this.ordersService.findOrderById(orderId, user.id, user.role);
  }

  // ─── PATCH /api/v1/orders/:id/cancel ─────────────────────────────
  // User tự huỷ đơn hàng của mình
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Huỷ đơn hàng (chỉ khi pending hoặc confirmed)' })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng' })
  cancelOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') userId: string,
  ): Promise<OrderEntity> {
    return this.ordersService.cancelOrder(orderId, userId);
  }

  // ─── PATCH /api/v1/orders/:id/status ─────────────────────────────
  // [ADMIN] Cập nhật trạng thái đơn hàng
  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Cập nhật trạng thái đơn hàng' })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng' })
  updateStatus(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderEntity> {
    return this.ordersService.updateOrderStatus(orderId, dto);
  }
}
