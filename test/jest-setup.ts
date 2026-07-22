import { Test } from '@nestjs/testing';

// jest-setup.ts: chạy trước TẤT CẢ test files
// Dùng để setup global timeout, mock, environment...

// Tăng timeout cho E2E test vì cần khởi động app + kết nối DB
// Mặc định Jest timeout = 5000ms — quá ngắn cho E2E
jest.setTimeout(30000); // 30 giây

// Suppress console.log trong test để output gọn hơn
// Uncomment nếu muốn ẩn log:
// global.console.log = jest.fn();
