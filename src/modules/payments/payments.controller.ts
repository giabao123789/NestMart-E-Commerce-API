import {
  Controller,
  Get,
  Post,
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
import { PaymentsService } from './payments.service';
import { MockCardPaymentDto } from './dto/payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { UserEntity } from '../users/infrastructure/user.entity';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── GET /api/v1/payments/orders/:orderId ────────────────────────
  // Xem thông tin thanh toán của đơn hàng
  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Xem thông tin thanh toán của đơn hàng' })
  @ApiParam({ name: 'orderId', description: 'UUID của đơn hàng' })
  getPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.paymentsService.getPaymentByOrderId(orderId, user);
  }

  // ─── POST /api/v1/payments/orders/:orderId/cod ───────────────────
  // Chọn thanh toán COD (tiền mặt khi nhận hàng)
  @Post('orders/:orderId/cod')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Thanh toán COD (tiền mặt khi nhận hàng)',
    description: 'Tạo payment record với status PENDING. Sẽ được cập nhật khi giao hàng.',
  })
  processCod(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.processCodPayment(orderId, userId);
  }

  // ─── POST /api/v1/payments/orders/:orderId/card ──────────────────
  // Thanh toán bằng thẻ (mock)
  @Post('orders/:orderId/card')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Thanh toán bằng thẻ (mock)',
    description:
      'Dùng số thẻ 4111111111111111 để test thanh toán thành công. ' +
      'Số thẻ khác có 20% chance thất bại.',
  })
  @ApiResponse({ status: 201, description: 'Kết quả thanh toán' })
  processMockCard(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: MockCardPaymentDto,
  ) {
    return this.paymentsService.processMockCardPayment(orderId, userId, dto);
  }

  // ─── POST /api/v1/payments/orders/:orderId/bank-transfer ─────────
  // Chọn thanh toán chuyển khoản — trả về thông tin ngân hàng
  @Post('orders/:orderId/bank-transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Thanh toán chuyển khoản ngân hàng',
    description: 'Trả về thông tin tài khoản ngân hàng để chuyển khoản.',
  })
  processBankTransfer(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.processBankTransfer(orderId, userId);
  }

  // ─── POST /api/v1/payments/orders/:orderId/confirm-transfer ──────
  // [ADMIN] Xác nhận đã nhận được tiền chuyển khoản
  @Post('orders/:orderId/confirm-transfer')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Xác nhận đã nhận thanh toán chuyển khoản',
  })
  confirmBankTransfer(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body('transactionId') transactionId: string,
  ) {
    return this.paymentsService.confirmBankTransfer(orderId, transactionId);
  }
}
