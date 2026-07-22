import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';

// ─── E2E Test Auth ────────────────────────────────────────────────────────────
// E2E test khởi động toàn bộ NestJS app thật
// Gửi HTTP request thật qua supertest
// Kiểm tra response thật từ đầu đến cuối
//
// Yêu cầu: PostgreSQL đang chạy (dùng DB test riêng)
// Chạy: npm run test:e2e
describe('Auth E2E', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  // ─── Setup app một lần trước TẤT CẢ test ─────────────────────────
  // beforeAll: chỉ chạy 1 lần — khởi động app, không tạo lại mỗi test
  // Tiết kiệm thời gian hơn beforeEach khi setup tốn thời gian
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Setup GIỐNG HỆT main.ts để test behavior thật
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI }); // VersioningType.URI = 1

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    await app.init();
  });

  // ─── Cleanup sau TẤT CẢ test ─────────────────────────────────────
  afterAll(async () => {
    await app.close();
  });

  // ─── Test Group: POST /api/v1/auth/register ───────────────────────
  describe('POST /api/v1/auth/register', () => {

    it('201 — đăng ký thành công với data hợp lệ', async () => {
      // request(app.getHttpServer()): tạo supertest instance với server của app
      // .post('/api/v1/auth/register'): gửi POST request
      // .send({...}): set request body
      // .expect(201): assert HTTP status code
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Trần Gia Bảo',
          email: `test-${Date.now()}@gmail.com`, // unique email mỗi lần chạy test
          password: 'Password123',
        })
        .expect(201);

      // Kiểm tra structure của response
      // TransformResponseInterceptor wrap trong { success, data, timestamp }
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Kiểm tra data có đầy đủ fields cần thiết
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toContain('@gmail.com');

      // Quan trọng: password KHÔNG được trả về
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('400 — thiếu field bắt buộc', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          // Thiếu email và password
        })
        .expect(400);

      expect(response.body.success).toBeUndefined();
      expect(response.body.statusCode).toBe(400);
      // message là array các lỗi validation
      expect(Array.isArray(response.body.message) || typeof response.body.message === 'string').toBe(true);
    });

    it('400 — email không hợp lệ', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'not-an-email', // email sai format
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('400 — password không đủ mạnh', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'test@gmail.com',
          password: 'weak', // không đủ 8 ký tự, không có chữ hoa + số
        })
        .expect(400);
    });

    it('400 — field lạ bị reject (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'test2@gmail.com',
          password: 'Password123',
          isAdmin: true, // field không có trong DTO → bị reject
        })
        .expect(400);
    });
  });

  // ─── Test Group: POST /api/v1/auth/login ─────────────────────────
  describe('POST /api/v1/auth/login', () => {
    const testEmail = `login-test-${Date.now()}@gmail.com`;
    const testPassword = 'Password123';

    // Đăng ký user trước khi test login
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Login Test User',
          email: testEmail,
          password: testPassword,
        });
    });

    it('200 — đăng nhập thành công', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Lưu tokens để dùng cho các test sau
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('401 — sai password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword123' })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
      expect(response.body.message).toContain('không chính xác');
    });

    it('401 — email không tồn tại', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@gmail.com',
          password: 'Password123',
        })
        .expect(401);
    });

    it('400 — thiếu email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: testPassword })
        .expect(400);
    });
  });

  // ─── Test Group: POST /api/v1/auth/me ────────────────────────────
  describe('POST /api/v1/auth/me', () => {

    it('200 — lấy thông tin user với valid token', async () => {
      // Skip nếu chưa có token từ login test
      if (!accessToken) return;

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/me')
        // .set(): set HTTP header
        // Authorization: Bearer <token> — format chuẩn của JWT
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.email).toBeDefined();
      expect(response.body.data.password).toBeUndefined();
    });

    it('401 — không có token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/me')
        // Không set Authorization header
        .expect(401);
    });

    it('401 — token sai format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);
    });

    it('401 — token giả mạo (signature không khớp)', async () => {
      // Tạo JWT giả — payload hợp lệ nhưng chữ ký sai
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJmYWtlLXVzZXIiLCJlbWFpbCI6ImZha2VAZ21haWwuY29tIn0.' +
        'invalid-signature';

      await request(app.getHttpServer())
        .post('/api/v1/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });
  });

  // ─── Test Group: POST /api/v1/auth/refresh ───────────────────────
  describe('POST /api/v1/auth/refresh', () => {

    it('200 — lấy access token mới bằng refresh token', async () => {
      if (!refreshToken) return;

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        // Gửi REFRESH token (không phải access token)
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Token mới phải khác token cũ (token rotation)
      expect(response.body.data.accessToken).not.toBe(accessToken);
      expect(response.body.data.refreshToken).not.toBe(refreshToken);

      // Cập nhật tokens mới để dùng tiếp
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('401 — dùng access token để refresh (sai loại token)', async () => {
      if (!accessToken) return;

      // Access token được ký bằng ACCESS_SECRET
      // Refresh endpoint dùng REFRESH_SECRET → verify sẽ fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  // ─── Test Group: POST /api/v1/auth/logout ────────────────────────
  describe('POST /api/v1/auth/logout', () => {

    it('200 — đăng xuất thành công', async () => {
      if (!accessToken) return;

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.message).toBe('Đăng xuất thành công');
    });

    it('401 — refresh token không dùng được sau khi logout', async () => {
      if (!refreshToken) return;

      // Sau khi logout, hashedRefreshToken trong DB = null
      // → refresh sẽ fail vì không tìm thấy hash để so sánh
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });
});
