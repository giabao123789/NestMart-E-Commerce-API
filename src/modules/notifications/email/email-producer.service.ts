import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  EmailJobName,
  EmailJobData,
  OrderConfirmationJobData,
  OrderStatusChangedJobData,
  PaymentSuccessJobData,
  WelcomeJobData,
} from './email-job.interface';

// Tên queue — phải khớp với @Processor() trong EmailProcessor
export const EMAIL_QUEUE = 'email';

// EmailProducerService: chịu trách nhiệm ĐƯA job vào queue
// Không xử lý email trực tiếp — chỉ "đặt hàng" vào queue
// EmailProcessor sẽ lấy job từ queue và xử lý
@Injectable()
export class EmailProducerService {
  private readonly logger = new Logger(EmailProducerService.name);

  constructor(
    // @InjectQueue(EMAIL_QUEUE): inject Queue instance của BullMQ
    // Queue này được đăng ký trong NotificationsModule
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  // ─── Helper private: thêm job vào queue ─────────────────────────────
  private async addJob(
    name: EmailJobName,
    data: EmailJobData,
    options?: {
      delay?: number;  // delay (ms): trì hoãn bao lâu trước khi xử lý
      priority?: number; // priority: ưu tiên — số nhỏ hơn = ưu tiên cao hơn
    },
  ) {
    const job = await this.emailQueue.add(name, data, {
      // attempts: số lần thử lại tối đa nếu job thất bại
      attempts: 3,

      // backoff: chiến lược retry — exponential = 1s, 2s, 4s
      backoff: {
        type: 'exponential',
        delay: 1000,
      },

      // removeOnComplete: xoá job khỏi queue sau khi hoàn thành
      // true: tiết kiệm memory Redis
      // Có thể set số (ví dụ 100) để giữ lại 100 job hoàn thành gần nhất
      removeOnComplete: true,

      // removeOnFail: giữ lại job thất bại để debug
      removeOnFail: 50, // giữ 50 job thất bại gần nhất

      delay: options?.delay,
      priority: options?.priority,
    });

    this.logger.log(
      `📧 Email job được tạo: [${name}] id=${job.id}`,
    );

    return job;
  }

  // ─── Gửi email xác nhận đặt hàng ─────────────────────────────────────
  // Gọi ngay sau khi tạo order thành công
  async sendOrderConfirmation(data: OrderConfirmationJobData) {
    return this.addJob(EmailJobName.ORDER_CONFIRMATION, data, {
      priority: 1, // ưu tiên cao — user đang chờ email xác nhận
    });
  }

  // ─── Gửi email thông báo thay đổi trạng thái đơn hàng ───────────────
  async sendOrderStatusChanged(data: OrderStatusChangedJobData) {
    return this.addJob(EmailJobName.ORDER_STATUS_CHANGED, data, {
      priority: 2,
    });
  }

  // ─── Gửi email xác nhận thanh toán thành công ────────────────────────
  async sendPaymentSuccess(data: PaymentSuccessJobData) {
    return this.addJob(EmailJobName.PAYMENT_SUCCESS, data, {
      priority: 1, // ưu tiên cao — thông báo thanh toán quan trọng
    });
  }

  // ─── Gửi email chào mừng user mới ────────────────────────────────────
  // Delay 5 giây để tránh gửi ngay khi user vừa đăng ký
  // (user có thể nhập sai email, cần thời gian verify)
  async sendWelcomeEmail(data: WelcomeJobData) {
    return this.addJob(EmailJobName.WELCOME, data, {
      delay: 5000, // delay 5 giây
      priority: 3, // ưu tiên thấp hơn email giao dịch
    });
  }

  // ─── Lấy thống kê queue (dùng cho monitoring) ────────────────────────
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),   // đang chờ xử lý
      this.emailQueue.getActiveCount(),    // đang được xử lý
      this.emailQueue.getCompletedCount(), // đã hoàn thành
      this.emailQueue.getFailedCount(),    // thất bại
      this.emailQueue.getDelayedCount(),   // đang bị delay
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
