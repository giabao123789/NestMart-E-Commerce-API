import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailProducerService, EMAIL_QUEUE } from './email/email-producer.service';
import { EmailProcessor } from './email/email.processor';

@Module({
  imports: [
    // BullModule.forRootAsync: cấu hình connection Redis cho BullMQ
    // forRootAsync: cấu hình bất đồng bộ, cần inject ConfigService
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          // BullMQ dùng Redis để lưu trữ queue và job data
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
        // defaultJobOptions: cấu hình mặc định cho tất cả jobs
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),

    // BullModule.registerQueue: đăng ký queue 'email'
    // Tạo ra Queue instance có thể inject bằng @InjectQueue(EMAIL_QUEUE)
    BullModule.registerQueue({
      name: EMAIL_QUEUE, // tên queue = 'email'
    }),
  ],

  providers: [
    // EmailProducerService: Producer — đưa job vào queue
    EmailProducerService,

    // EmailProcessor: Consumer — lấy job từ queue và xử lý
    // @Processor(EMAIL_QUEUE) tự động đăng ký với BullMQ
    EmailProcessor,
  ],

  // Export EmailProducerService để các module khác inject và dùng
  // OrdersService, PaymentsService cần gửi email sau khi xử lý xong
  exports: [EmailProducerService],
})
export class NotificationsModule {}
