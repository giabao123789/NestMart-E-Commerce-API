import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentEntity, PaymentStatus } from './entities/payment.entity';
import { OrderEntity, OrderStatus, PaymentMethod } from '../orders/entities/order.entity';
import { MockCardPaymentDto } from './dto/payment.dto';
import { EmailProducerService } from '../notifications/email/email-producer.service';
import { UserEntity } from '../users/infrastructure/user.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,

    private readonly dataSource: DataSource,

    // Inject EmailProducerService để gửi email sau khi thanh toán
    private readonly emailProducer: EmailProducerService,
  ) {}

  // ─── Lấy thông tin thanh toán theo orderId ───────────────────────────
  async getPaymentByOrderId(
    orderId: string,
    user: UserEntity,
  ): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      relations: { order: true },
    });

    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy thông tin thanh toán cho đơn hàng: ${orderId}`,
      );
    }

    // Chỉ admin hoặc chủ đơn hàng mới xem được
    if (
      user.role !== 'admin' &&
      payment.order.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền xem thông tin thanh toán này',
      );
    }

    return payment;
  }

  // ─── Xử lý thanh toán COD ────────────────────────────────────────────
  // COD (Cash on Delivery — Thanh toán khi nhận hàng):
  // Tạo payment record với status PENDING
  // isPaid chỉ được set true khi admin đánh dấu delivered
  async processCodPayment(
    orderId: string,
    userId: string,
  ): Promise<PaymentEntity> {
    const order = await this.validateOrderForPayment(orderId, userId);

    // Kiểm tra đã có payment chưa
    const existing = await this.paymentRepository.findOne({
      where: { orderId },
    });
    if (existing) {
      throw new BadRequestException(
        'Đơn hàng này đã có thông tin thanh toán',
      );
    }

    // Tạo payment record cho COD
    const payment = this.paymentRepository.create({
      orderId,
      amount: Number(order.totalAmount),
      method: PaymentMethod.COD,
      status: PaymentStatus.PENDING, // COD chưa thanh toán ngay
      metadata: { note: 'Thanh toán khi nhận hàng' },
    });

    const saved = await this.paymentRepository.save(payment);

    // Gửi email xác nhận đơn hàng qua Queue (bất đồng bộ)
    // Không chờ email gửi xong mới trả response → response nhanh hơn
    await this.emailProducer.sendOrderConfirmation({
      orderId: order.id,
      orderNumber: order.orderNumber,
      userEmail: userId, // trong production: lấy từ user entity
      userName: order.shippingAddress.fullName,
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.productPrice),
        subtotal: Number(item.subtotal),
      })),
      shippingAddress: order.shippingAddress,
    });

    return saved;
  }

  // ─── Xử lý thanh toán mock card ──────────────────────────────────────
  // Trong production: tích hợp VNPay, Momo, Stripe SDK
  // Ở đây chỉ mock logic để demo toàn bộ flow
  async processMockCardPayment(
    orderId: string,
    userId: string,
    dto: MockCardPaymentDto,
  ): Promise<PaymentEntity> {
    const order = await this.validateOrderForPayment(orderId, userId);

    const existing = await this.paymentRepository.findOne({
      where: { orderId },
    });
    if (existing) {
      throw new BadRequestException('Đơn hàng này đã có thông tin thanh toán');
    }

    // ─── Mock payment logic ───────────────────────────────────────────
    // Giả lập gọi payment gateway API
    const mockResult = await this.simulatePaymentGateway(dto);

    // Transaction: cập nhật payment + order.isPaid cùng lúc
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tạo payment record
      const payment = queryRunner.manager.create(PaymentEntity, {
        orderId,
        amount: Number(order.totalAmount),
        method: PaymentMethod.MOCK_CARD,
        status: mockResult.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        transactionId: mockResult.transactionId,
        paidAt: mockResult.success ? new Date() : undefined,
        metadata: {
          cardLast4: dto.cardNumber.slice(-4), // chỉ lưu 4 số cuối — bảo mật
          cardHolder: dto.cardHolder,
          gatewayResponse: mockResult.responseCode,
        },
      });

      const savedPayment = await queryRunner.manager.save(PaymentEntity, payment);

      if (mockResult.success) {
        // Cập nhật order.isPaid = true
        await queryRunner.manager.update(OrderEntity, orderId, {
          isPaid: true,
          status: OrderStatus.CONFIRMED, // tự động confirm khi thanh toán xong
        });
      }

      await queryRunner.commitTransaction();

      // Gửi email thông báo kết quả thanh toán qua Queue
      if (mockResult.success) {
        await this.emailProducer.sendPaymentSuccess({
          orderId: order.id,
          orderNumber: order.orderNumber,
          userEmail: userId,
          userName: order.shippingAddress.fullName,
          amount: Number(order.totalAmount),
          transactionId: mockResult.transactionId,
          paidAt: new Date(),
        });
      }

      return savedPayment;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Xử lý thanh toán chuyển khoản ──────────────────────────────────
  // Tạo payment pending, admin xác nhận sau khi nhận tiền
  async processBankTransfer(
    orderId: string,
    userId: string,
  ): Promise<{ payment: PaymentEntity; bankInfo: object }> {
    const order = await this.validateOrderForPayment(orderId, userId);

    const existing = await this.paymentRepository.findOne({
      where: { orderId },
    });
    if (existing) {
      throw new BadRequestException('Đơn hàng này đã có thông tin thanh toán');
    }

    const payment = this.paymentRepository.create({
      orderId,
      amount: Number(order.totalAmount),
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.PENDING,
      metadata: {
        bankAccount: '1234567890',
        bankName: 'Vietcombank',
        accountName: 'CONG TY NESTMART',
        // transferContent: nội dung chuyển khoản để đối chiếu
        transferContent: `NESTMART ${order.orderNumber}`,
      },
    });

    const saved = await this.paymentRepository.save(payment);

    // Thông tin ngân hàng trả về cho user
    const bankInfo = {
      bankName: 'Vietcombank (VCB)',
      accountNumber: '1234567890',
      accountName: 'CONG TY NESTMART',
      amount: Number(order.totalAmount),
      transferContent: `NESTMART ${order.orderNumber}`,
      note: 'Vui lòng chuyển khoản trong vòng 24 giờ. Đơn hàng sẽ tự động huỷ nếu chưa nhận được thanh toán.',
    };

    return { payment: saved, bankInfo };
  }

  // ─── [ADMIN] Xác nhận thanh toán chuyển khoản ────────────────────────
  async confirmBankTransfer(
    orderId: string,
    transactionId: string,
  ): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy payment record');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment đang ở trạng thái "${payment.status}", không thể xác nhận`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Cập nhật payment status
      payment.status = PaymentStatus.SUCCESS;
      payment.transactionId = transactionId;
      payment.paidAt = new Date();
      await queryRunner.manager.save(PaymentEntity, payment);

      // Cập nhật order isPaid + status
      await queryRunner.manager.update(OrderEntity, orderId, {
        isPaid: true,
        status: OrderStatus.CONFIRMED,
      });

      await queryRunner.commitTransaction();
      return payment;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Helper: validate order trước khi thanh toán ─────────────────────
  private async validateOrderForPayment(
    orderId: string,
    userId: string,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    // Chỉ chủ đơn hàng mới thanh toán được
    if (order.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền thanh toán đơn hàng này',
      );
    }

    // Chỉ thanh toán được khi đơn đang PENDING
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Đơn hàng đang ở trạng thái "${order.status}", không thể thanh toán`,
      );
    }

    // Không thanh toán đơn đã paid
    if (order.isPaid) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán');
    }

    return order;
  }

  // ─── Helper: mock payment gateway ────────────────────────────────────
  // Giả lập gọi API của payment gateway bên ngoài
  // Trong production: thay bằng VNPay SDK, Stripe SDK...
  private async simulatePaymentGateway(dto: MockCardPaymentDto): Promise<{
    success: boolean;
    transactionId: string;
    responseCode: string;
  }> {
    // Giả lập độ trễ network khi gọi payment gateway (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Số thẻ bắt đầu bằng '4111' → luôn thành công (Visa test card)
    // Số thẻ khác → có 20% chance thất bại (để test error handling)
    const isTestCard = dto.cardNumber.startsWith('4111');
    const success = isTestCard || Math.random() > 0.2;

    return {
      success,
      transactionId: success
        ? `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : '',
      responseCode: success ? '00' : '51', // 00 = success, 51 = insufficient funds
    };
  }
}
