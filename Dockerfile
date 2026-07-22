# ─── STAGE 1: Builder ────────────────────────────────────────────────────────
# Multi-stage build (build nhiều giai đoạn):
# Giai đoạn 1: cài dependencies + compile TypeScript → tạo ra /dist
# Giai đoạn 2: chỉ copy /dist và node_modules production → image nhỏ hơn
#
# Lợi ích: image production không chứa devDependencies, source .ts, node_modules dev
# Kết quả: image nhỏ hơn ~60% so với build đơn giản

FROM node:20-alpine AS builder

# Đặt thư mục làm việc trong container
WORKDIR /app

# Copy package files trước — tận dụng Docker layer cache
# Nếu package.json không thay đổi → npm install không chạy lại
# Chỉ khi package.json thay đổi → layer này mới được rebuild
COPY package*.json ./
COPY tsconfig*.json ./

# Cài tất cả dependencies (kể cả devDependencies để compile TS)
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Build: compile TypeScript → JavaScript trong thư mục /dist
RUN npm run build

# ─── STAGE 2: Production ─────────────────────────────────────────────────────
# FROM node:20-alpine: image Node.js nhỏ gọn (Alpine Linux)
# alpine: ~5MB thay vì ~900MB của ubuntu — không có tool thừa
FROM node:20-alpine AS production

# Metadata của image
LABEL maintainer="NestMart Team"
LABEL version="1.0.0"
LABEL description="NestMart E-Commerce API"

WORKDIR /app

# Copy package files để cài production dependencies
COPY package*.json ./

# npm ci --omit=dev: chỉ cài production dependencies
# Bỏ qua devDependencies (jest, ts-jest, @types/...) → nhỏ hơn nhiều
RUN npm ci --omit=dev

# Copy compiled JavaScript từ stage builder
COPY --from=builder /app/dist ./dist

# Tạo user non-root để chạy app — bảo mật tốt hơn
# Không chạy app với root → nếu bị hack, attacker không có full quyền
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Đổi ownership thư mục /app sang user nestjs
RUN chown -R nestjs:nodejs /app

# Switch sang user non-root
USER nestjs

# Port app lắng nghe
EXPOSE 3000

# Healthcheck: Docker tự kiểm tra container có healthy không
# Nếu unhealthy → Docker có thể restart container tự động
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# CMD: lệnh chạy khi container khởi động
# Dùng node trực tiếp thay vì npm start để nhận signal SIGTERM đúng cách
# (graceful shutdown hoạt động đúng)
CMD ["node", "dist/main.js"]
