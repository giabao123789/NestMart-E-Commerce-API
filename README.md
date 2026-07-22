# 🛒 NestMart — E-Commerce REST API

> API backend cho hệ thống thương mại điện tử, build với **NestJS** theo **Clean Architecture** và **CQRS Pattern**.

## 🚀 Tech Stack

| Công nghệ | Mục đích |
|---|---|
| **NestJS 11** | Backend framework |
| **TypeScript** | Ngôn ngữ lập trình |
| **PostgreSQL** | Cơ sở dữ liệu chính |
| **TypeORM** | ORM |
| **Redis** | Cache & Queue storage |
| **BullMQ** | Queue xử lý email |
| **JWT + Passport** | Authentication |
| **Docker** | Containerization |
| **Jest + Supertest** | Testing |
| **Swagger** | API Documentation |

## ⚡ Cài đặt nhanh

```bash
# 1. Clone repo
git clone https://github.com/your-username/nestmart.git
cd nestmart

# 2. Cài dependencies
npm install

# 3. Cấu hình môi trường
cp .env.example .env
# Chỉnh sửa .env: đặt JWT_ACCESS_SECRET và JWT_REFRESH_SECRET >= 32 ký tự

# 4. Khởi động PostgreSQL + Redis
docker-compose up -d

# 5. Chạy app
npm run start:dev

# 6. Tạo seed data
npm run seed

# 7. Mở Swagger
open http://localhost:3000/docs
```

## 📚 API Endpoints

| Module | Base URL | Public | JWT | Admin |
|---|---|---|---|---|
| Auth | /api/v1/auth | register, login | refresh, logout, me | - |
| Users | /api/v1/users | - | profile | list, delete |
| Categories | /api/v1/categories | GET all/slug | - | POST, PATCH, DELETE |
| Products | /api/v1/products | GET all/slug | - | POST, PATCH, DELETE |
| Cart | /api/v1/cart | - | All | - |
| Orders | /api/v1/orders | - | CRUD | all, status |
| Payments | /api/v1/payments | - | COD, card, bank | confirm |
| Health | /api/health | GET | - | - |

## 🧪 Testing

```bash
npm run test          # Unit tests (40 tests)
npm run test:cov      # Coverage report
npm run test:e2e      # E2E tests (cần DB đang chạy)
```

## 🐳 Docker

```bash
npm run docker:dev    # Dev: PostgreSQL + Redis
npm run docker:prod   # Production: full stack
```

## 👤 Tài khoản test

| Role | Email | Password |
|---|---|---|
| Admin | admin@nestmart.com | Admin123! |
| User | bao@gmail.com | User123! |

## 🏗️ Kiến trúc & Patterns

- **Clean Architecture**: domain → application → infrastructure → presentation
- **CQRS**: Command/Query/Event tách biệt (Products, Orders)
- **Cache-Aside**: Redis cache cho Categories và Products
- **Transaction**: ACID khi đặt hàng (trừ stock + tạo order + xoá cart)
- **Repository Pattern**: tách biệt data access
- **Queue**: BullMQ email notification bất đồng bộ
