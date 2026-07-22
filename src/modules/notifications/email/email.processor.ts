import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  EmailJobName,
  EmailJobData,
  OrderConfirmationJobData,
  OrderStatusChangedJobData,
  PaymentSuccessJobData,
  WelcomeJobData,
} from './email-job.interface';
import { EMAIL_QUEUE } from './email-producer.service';

// @Processor(EMAIL_QUEUE): đăng ký class này là Consumer của queue 'email'
// WorkerHost: base class của @nestjs/bullmq — cung cấp method process()
// Khi có job mới trong queue → BullMQ tự động gọi process()
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  // process(): method BẮT BUỘC phải implement từ WorkerHost
  // BullMQ gọi method này mỗi khi có job mới cần xử lý
  // job.name: tên job (EmailJobName)
  // job.data: data của job (EmailJobData)
  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(
      `⚙️  Đang xử lý email job: [${job.name}] id=${job.id} attempt=${job.attemptsMade + 1}`,
    );

    // Switch theo tên job để xử lý đúng loại email
    switch (job.name) {
      case EmailJobName.ORDER_CONFIRMATION:
        await this.handleOrderConfirmation(
          job as Job<OrderConfirmationJobData>,
        );
        break;

      case EmailJobName.ORDER_STATUS_CHANGED:
        await this.handleOrderStatusChanged(
          job as Job<OrderStatusChangedJobData>,
        );
        break;

      case EmailJobName.PAYMENT_SUCCESS:
        await this.handlePaymentSuccess(
          job as Job<PaymentSuccessJobData>,
        );
        break;

      case EmailJobName.WELCOME:
        await this.handleWelcomeEmail(job as Job<WelcomeJobData>);
        break;

      default:
        this.logger.warn(`❓ Không xác định được loại email job: ${job.name}`);
    }
  }

  // ─── Xử lý email xác nhận đặt hàng ──────────────────────────────────
  private async handleOrderConfirmation(
    job: Job<OrderConfirmationJobData>,
  ): Promise<void> {
    const { userEmail, userName, orderNumber, totalAmount, items, shippingAddress } =
      job.data;

    // Cập nhật progress (tiến độ) để monitoring biết đang làm gì
    await job.updateProgress(20);

    // Trong production: dùng nodemailer, SendGrid, AWS SES...
    // Ở đây chỉ log để demo — không cần cài thêm package email
    this.logger.log(`
      ✉️  GỬI EMAIL XÁC NHẬN ĐẶT HÀNG
      ─────────────────────────────────────
      Tới       : ${userEmail} (${userName})
      Đơn hàng  : ${orderNumber}
      Tổng tiền : ${totalAmount.toLocaleString('vi-VN')}₫
      Địa chỉ   : ${shippingAddress.address}, ${shippingAddress.city}
      Sản phẩm  : ${items.length} loại
      ${items.map((i) => `  - ${i.productName} x${i.quantity} = ${i.subtotal.toLocaleString('vi-VN')}₫`).join('\n')}
      ─────────────────────────────────────
    `);

    await job.updateProgress(100);
  }

  // ─── Xử lý email thông báo thay đổi trạng thái ───────────────────────
  private async handleOrderStatusChanged(
    job: Job<OrderStatusChangedJobData>,
  ): Promise<void> {
    const { userEmail, userName, orderNumber, oldStatus, newStatus } = job.data;

    await job.updateProgress(20);

    // Map status sang tiếng Việt để email thân thiện hơn
    const statusLabels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao hàng',
      delivered: 'Đã giao thành công',
      cancelled: 'Đã huỷ',
    };

    this.logger.log(`
      ✉️  GỬI EMAIL THAY ĐỔI TRẠNG THÁI ĐƠN HÀNG
      ─────────────────────────────────────────────
      Tới       : ${userEmail} (${userName})
      Đơn hàng  : ${orderNumber}
      Trạng thái: ${statusLabels[oldStatus]} → ${statusLabels[newStatus]}
      ─────────────────────────────────────────────
    `);

    await job.updateProgress(100);
  }

  // ─── Xử lý email xác nhận thanh toán ─────────────────────────────────
  private async handlePaymentSuccess(
    job: Job<PaymentSuccessJobData>,
  ): Promise<void> {
    const { userEmail, userName, orderNumber, amount, transactionId, paidAt } =
      job.data;

    await job.updateProgress(20);

    this.logger.log(`
      ✉️  GỬI EMAIL THANH TOÁN THÀNH CÔNG
      ─────────────────────────────────────
      Tới         : ${userEmail} (${userName})
      Đơn hàng    : ${orderNumber}
      Số tiền     : ${amount.toLocaleString('vi-VN')}₫
      Mã giao dịch: ${transactionId}
      Thời gian   : ${paidAt}
      ─────────────────────────────────────
    `);

    await job.updateProgress(100);
  }

  // ─── Xử lý email chào mừng user mới ──────────────────────────────────
  private async handleWelcomeEmail(job: Job<WelcomeJobData>): Promise<void> {
    const { userEmail, userName } = job.data;

    await job.updateProgress(20);

    this.logger.log(`
      ✉️  GỬI EMAIL CHÀO MỪNG
      ─────────────────────────────────────
      Tới : ${userEmail}
      Tên : ${userName}
      Nội dung: Chào mừng ${userName} đến với NestMart!
      ─────────────────────────────────────
    `);

    await job.updateProgress(100);
  }

  // ─── Event Hooks — lifecycle của worker ──────────────────────────────
  // Các decorator này lắng nghe events của BullMQ worker

  // @OnWorkerEvent('completed'): chạy khi job hoàn thành
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(
      `✅ Email job hoàn thành: [${job.name}] id=${job.id} ` +
      `sau ${Date.now() - job.timestamp}ms`,
    );
  }

  // @OnWorkerEvent('failed'): chạy khi job thất bại (sau tất cả attempts)
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `❌ Email job thất bại: [${job.name}] id=${job.id} ` +
      `attempt=${job.attemptsMade}/${job.opts.attempts} ` +
      `lỗi: ${error.message}`,
    );
  }

  // @OnWorkerEvent('progress'): chạy khi job.updateProgress() được gọi
  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`⏳ Job [${job.name}] id=${job.id} tiến độ: ${progress}%`);
  }
}
