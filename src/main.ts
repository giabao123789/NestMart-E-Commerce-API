import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // bufferLogs: true: giữ log lại cho đến khi logger được setup
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';

  // ─── 1. Security Headers bằng Helmet ─────────────────────────────
  // Helmet thêm các HTTP header bảo mật ngăn nhiều loại tấn công phổ biến
  app.use(helmet());

  // ─── 2. Compression: nén response giảm bandwidth ─────────────────
  app.use(compression());

  // ─── 3. CORS: Cross-Origin Resource Sharing ──────────────────────
  // Chỉ cho phép request từ các origin (nguồn gốc) được phép
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ─── 4. Global API Prefix: /api/... ──────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ─── 5. API Versioning: /api/v1/... ──────────────────────────────
  // URI versioning: version nằm trong URL
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── 6. Global ValidationPipe ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: loại bỏ field không có trong DTO — bảo mật mass assignment
      whitelist: true,
      // forbidNonWhitelisted: throw 400 nếu client gửi field không hợp lệ
      forbidNonWhitelisted: true,
      // transform: tự động convert type (string → number, plain obj → class instance)
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── 7. Graceful Shutdown ─────────────────────────────────────────
  // Lắng nghe SIGTERM/SIGINT — xử lý hết request đang chạy trước khi tắt
  app.enableShutdownHooks();

  // ─── 8. Swagger Documentation ────────────────────────────────────
  if (configService.get('app.nodeEnv') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NestMart API')
      .setDescription('E-Commerce REST API được build với NestJS')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập JWT access token',
        },
        'JWT-auth', // tên scheme — dùng trong @ApiBearerAuth('JWT-auth')
      )
      .addTag('Auth', 'Xác thực người dùng')
      .addTag('Users', 'Quản lý người dùng')
      .addTag('Categories', 'Quản lý danh mục')
      .addTag('Products', 'Quản lý sản phẩm')
      .addTag('Cart', 'Giỏ hàng')
      .addTag('Orders', 'Đơn hàng')
      .addTag('Payments', 'Thanh toán')
      .addTag('Health', 'Kiểm tra sức khoẻ hệ thống')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // giữ token sau khi refresh trang
        tagsSorter: 'alpha',
      },
    });

    logger.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  }

  await app.listen(port);
  logger.log(`🚀 NestMart đang chạy tại: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🌍 Môi trường: ${configService.get('app.nodeEnv')}`);
}

bootstrap();