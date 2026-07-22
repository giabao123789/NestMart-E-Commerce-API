import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/payment.entity';

// ─── DTO thanh toán đơn hàng ──────────────────────────────────────────────────
export class ProcessPaymentDto {
  @ApiPropertyOptional({
    description: 'Mã giao dịch từ payment gateway (nếu có)',
    example: 'TXN-20240115-ABC123',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Metadata bổ sung từ payment gateway',
    example: { bankCode: 'VCB', cardType: 'ATM' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

// ─── DTO mock card payment ────────────────────────────────────────────────────
// Mô phỏng thanh toán bằng thẻ — trong production thay bằng VNPay/Stripe SDK
export class MockCardPaymentDto {
  @ApiProperty({
    description: 'Số thẻ mock (16 chữ số)',
    example: '4111111111111111', // Visa test card number
  })
  @IsString()
  cardNumber: string;

  @ApiProperty({ description: 'Tên chủ thẻ', example: 'TRAN GIA BAO' })
  @IsString()
  cardHolder: string;

  @ApiProperty({ description: 'Ngày hết hạn MM/YY', example: '12/26' })
  @IsString()
  expiryDate: string;

  @ApiProperty({ description: 'Mã CVV', example: '123' })
  @IsString()
  cvv: string;
}
