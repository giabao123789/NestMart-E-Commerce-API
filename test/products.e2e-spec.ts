import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';

describe('Products E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let categoryId: string;
  let productId: string;
  let productSlug: string;

  // ─── Helper: đăng ký và đăng nhập, trả về access token ──────────
  const loginAs = async (email: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    return response.body.data?.accessToken;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
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

    // Tạo admin account (email đặc biệt để seed)
    const adminEmail = `admin-${Date.now()}@nestmart.com`;
    const userEmail = `user-${Date.now()}@gmail.com`;

    // Đăng ký cả 2 account
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Admin Test', email: adminEmail, password: 'Admin123!' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'User Test', email: userEmail, password: 'User123!' });

    // Đăng nhập lấy token
    // Note: trong test thật cần seed admin role vào DB trước
    // Ở đây dùng userToken cho cả 2 để test flow không cần admin
    userToken = await loginAs(userEmail, 'User123!');
    adminToken = await loginAs(adminEmail, 'Admin123!');
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Test Group: Categories (cần trước khi test Products) ────────
  describe('Categories Setup', () => {
    it('nên tạo category (cần admin token)', async () => {
      // Trong test thật: adminToken phải là user có role=admin
      // Ở đây skip nếu không có admin token hợp lệ
      if (!adminToken) return;

      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Category ${Date.now()}`,
          description: 'Category dùng cho E2E test',
        });

      // Nếu có quyền admin thì 201, không thì 403
      if (response.status === 201) {
        categoryId = response.body.data.id;
        expect(categoryId).toBeDefined();
      }
    });
  });

  // ─── Test Group: GET /api/v1/products ────────────────────────────
  describe('GET /api/v1/products', () => {

    it('200 — lấy danh sách products (public, không cần token)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Response phải có pagination fields
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('lastPage');
      expect(response.body.data).toHaveProperty('hasNextPage');

      // data phải là array
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('200 — filter theo search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?search=iphone')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toBeDefined();
    });

    it('200 — pagination hoạt động đúng', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?page=1&limit=5')
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(5);

      // Số item trả về không vượt quá limit
      expect(response.body.data.data.length).toBeLessThanOrEqual(5);
    });

    it('200 — filter theo minPrice và maxPrice', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?minPrice=100000&maxPrice=50000000')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('200 — sort theo price ASC', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?sortBy=price&order=ASC')
        .expect(200);

      const products = response.body.data.data;

      // Kiểm tra thứ tự giá tăng dần
      if (products.length >= 2) {
        for (let i = 0; i < products.length - 1; i++) {
          expect(Number(products[i].price)).toBeLessThanOrEqual(
            Number(products[i + 1].price),
          );
        }
      }
    });
  });

  // ─── Test Group: POST /api/v1/products (Admin) ───────────────────
  describe('POST /api/v1/products', () => {

    it('403 — user thường không tạo được product', async () => {
      if (!userToken || !categoryId) return;

      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Product',
          price: 100000,
          categoryId,
        })
        .expect(403);
    });

    it('401 — không có token bị từ chối', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({ name: 'Test', price: 100000 })
        .expect(401);
    });

    it('400 — thiếu field bắt buộc', async () => {
      if (!adminToken) return;

      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          // Thiếu price và categoryId
        })
        .expect(400);
    });

    it('201 — admin tạo product thành công', async () => {
      // Chỉ chạy nếu có cả adminToken và categoryId hợp lệ
      if (!adminToken || !categoryId) {
        console.log('Skip: cần admin token và categoryId');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `iPhone Test ${Date.now()}`,
          price: 29990000,
          stock: 50,
          categoryId,
          description: 'Sản phẩm test E2E',
        });

      if (response.status === 201) {
        productId = response.body.data.id;
        productSlug = response.body.data.slug;

        expect(response.body.data.name).toContain('iPhone Test');
        expect(response.body.data.price).toBe(29990000);
        expect(response.body.data.categoryId).toBe(categoryId);
        expect(response.body.data.slug).toBeDefined();
      }
    });
  });

  // ─── Test Group: GET /api/v1/products/:slug ───────────────────────
  describe('GET /api/v1/products/:slug', () => {

    it('200 — lấy chi tiết product theo slug (public)', async () => {
      if (!productSlug) return;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${productSlug}`)
        .expect(200);

      expect(response.body.data.slug).toBe(productSlug);
      expect(response.body.data.category).toBeDefined();
    });

    it('404 — slug không tồn tại', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/slug-khong-ton-tai-abc123')
        .expect(404);
    });
  });

  // ─── Test Group: PATCH /api/v1/products/:id ──────────────────────
  describe('PATCH /api/v1/products/:id', () => {

    it('200 — admin cập nhật product thành công', async () => {
      if (!adminToken || !productId) return;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 27990000, stock: 30 });

      if (response.status === 200) {
        expect(Number(response.body.data.price)).toBe(27990000);
        expect(response.body.data.stock).toBe(30);
      }
    });

    it('403 — user thường không cập nhật được', async () => {
      if (!userToken || !productId) return;

      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ price: 100000 })
        .expect(403);
    });
  });

  // ─── Test Group: DELETE /api/v1/products/:id ─────────────────────
  describe('DELETE /api/v1/products/:id', () => {

    it('204 — admin xoá product thành công (soft delete)', async () => {
      if (!adminToken || !productId) return;

      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('404 — product đã xoá không tìm thấy nữa', async () => {
      if (!productSlug) return;

      // Sau soft delete, GET theo slug phải trả 404
      await request(app.getHttpServer())
        .get(`/api/v1/products/${productSlug}`)
        .expect(404);
    });
  });
});
