// Định nghĩa tên các loại job email
// Dùng enum thay vì string literal để tránh typo
export enum EmailJobName {
  ORDER_CONFIRMATION = 'order-confirmation',   // xác nhận đặt hàng
  ORDER_STATUS_CHANGED = 'order-status-changed', // thay đổi trạng thái
  PAYMENT_SUCCESS = 'payment-success',         // thanh toán thành công
  WELCOME = 'welcome',                         // chào mừng user mới
}

// ─── Data types cho từng loại email job ──────────────────────────────────────
// Mỗi job type có data riêng phù hợp với template email đó

export interface OrderConfirmationJobData {
  orderId: string;
  orderNumber: string;
  userEmail: string;
  userName: string;
  totalAmount: number;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
  };
}

export interface OrderStatusChangedJobData {
  orderId: string;
  orderNumber: string;
  userEmail: string;
  userName: string;
  oldStatus: string;   // trạng thái cũ
  newStatus: string;   // trạng thái mới
}

export interface PaymentSuccessJobData {
  orderId: string;
  orderNumber: string;
  userEmail: string;
  userName: string;
  amount: number;
  transactionId: string;
  paidAt: Date;
}

export interface WelcomeJobData {
  userEmail: string;
  userName: string;
}

// Union type — job data có thể là 1 trong 4 loại trên
export type EmailJobData =
  | OrderConfirmationJobData
  | OrderStatusChangedJobData
  | PaymentSuccessJobData
  | WelcomeJobData;
