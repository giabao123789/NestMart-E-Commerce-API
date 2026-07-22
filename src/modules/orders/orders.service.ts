import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { CartItemEntity } from '../cart/entities/cart-item.entity';
import { ProductEntity } from '../products/infrastructure/product.entity';
import { CreateOrderDto, UpdateOrderStatusDto, OrderQueryDto } from './dto/order.dto';
import { UserRole } from '../users/infrastructure/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,

    // DataSource: cần để tạo QueryRunner cho Transaction
    // DataSource là root connection của TypeORM — quản lý tất cả connections
    private readonly dataSource: DataSource,

    private readonly cartService: CartService,
  ) {}

  // ─── Tạo đơn hàng — QUAN TRỌNG NHẤT, dùng Transaction ───────────────
  //
  // Transaction đảm bảo tính ACID:
  // A - Atomicity (Nguyên tử): tất cả thành công hoặc tất cả thất bại
  // C - Consistency (Nhất quán): dữ liệu luôn ở trạng thái hợp lệ
  // I - Isolation (Cô lập): transaction này không thấy thay đổi của transaction khác
  // D - Durability (Bền vững): sau khi commit, dữ liệu được lưu vĩnh viễn
  //
  // Nếu không dùng Transaction và lỗi xảy ra giữa chừng:
  // - Đã trừ stock nhưng chưa tạo order → mất hàng trong kho
  // - Đã tạo order nhưng chưa xoá cart → user mua lại sẽ có đơn trùng
  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderEntity> {
    // Lấy giỏ hàng hiện tại
    const cart = await this.cartService.getCartEntity(userId);

    // Kiểm tra giỏ hàng không được rỗng
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException(
        'Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi đặt hàng.',
      );
    }

    // ─── Bắt đầu Transaction ─────────────────────────────────────────
    // QueryRunner: đối tượng quản lý 1 transaction cụ thể
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();     // kết nối DB
    await queryRunner.startTransaction(); // bắt đầu transaction

    try {
      // Bước 1: Validate stock và tính tổng tiền
      // Làm trong transaction để tránh race condition
      // (2 user cùng mua sản phẩm cuối cùng cùng lúc)
      let totalAmount = 0;
      const orderItemsData: Partial<OrderItemEntity>[] = [];

      for (const cartItem of cart.items) {
        // Dùng queryRunner.manager để query TRONG transaction
        // Khác với this.productRepository (query ngoài transaction)
        const product = await queryRunner.manager.findOne(ProductEntity, {
          where: { id: cartItem.productId, isActive: true },
          // lock: { mode: 'pessimistic_write' }: khóa row để không ai khác sửa
          // trong khi transaction này đang chạy → tránh race condition
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new BadRequestException(
            `Sản phẩm "${cartItem.product?.name}" không còn tồn tại`,
          );
        }

        // Kiểm tra stock
        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" chỉ còn ${product.stock} trong kho`,
          );
        }

        // Trừ stock trực tiếp trong transaction
        await queryRunner.manager.decrement(
          ProductEntity,
          { id: product.id },
          'stock',
          cartItem.quantity,
        );

        // Tính subtotal cho item này
        const subtotal = Number(product.price) * cartItem.quantity;
        totalAmount += subtotal;

        // Chuẩn bị data cho order item — SNAPSHOT thông tin sản phẩm
        orderItemsData.push({
          productId: product.id,
          productName: product.name,           // snapshot tên
          productPrice: Number(product.price), // snapshot giá tại thời điểm đặt
          productImage: product.imageUrl,       // snapshot ảnh
          quantity: cartItem.quantity,
          subtotal,
        });
      }

      // Bước 2: Tạo order number (mã đơn hàng)
      const orderNumber = this.generateOrderNumber();

      // Bước 3: Tạo Order entity trong transaction
      const order = queryRunner.manager.create(OrderEntity, {
        orderNumber,
        userId,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        shippingAddress: dto.shippingAddress,
        note: dto.note,
        status: OrderStatus.PENDING,
      });

      const savedOrder = await queryRunner.manager.save(OrderEntity, order);

      // Bước 4: Tạo các Order Items trong transaction
      const orderItems = orderItemsData.map((itemData) =>
        queryRunner.manager.create(OrderItemEntity, {
          ...itemData,
          orderId: savedOrder.id,
        }),
      );

      await queryRunner.manager.save(OrderItemEntity, orderItems);

      // Bước 5: Xoá toàn bộ cart items sau khi đặt hàng thành công
      await queryRunner.manager.delete(CartItemEntity, { cartId: cart.id });

      // Bước 6: COMMIT — xác nhận tất cả thay đổi vào DB
      // Chỉ sau bước này dữ liệu mới được lưu thật sự
      await queryRunner.commitTransaction();

      // Load lại order với đầy đủ relations để trả về
      const result = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: { items: true },
      });
      return result!;

    } catch (error) {
      // ROLLBACK: huỷ toàn bộ thay đổi nếu có lỗi bất kỳ
      // DB trở về trạng thái trước khi bắt đầu transaction
      await queryRunner.rollbackTransaction();
      throw error; // ném lại lỗi để GlobalExceptionFilter xử lý
    } finally {
      // RELEASE: trả connection về pool dù thành công hay thất bại
      // Nếu không release → connection leak → app hết connection
      await queryRunner.release();
    }
  }

  // ─── Lấy danh sách đơn hàng của user ─────────────────────────────────
  async findMyOrders(userId: string, query: OrderQueryDto) {
    const { status, page = 1, limit = 10 } = query;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC');

    // Filter theo status nếu có
    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }

  // ─── Lấy chi tiết 1 đơn hàng ─────────────────────────────────────────
  async findOrderById(
    orderId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    // Chỉ admin hoặc chủ đơn hàng mới xem được
    if (userRole !== UserRole.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    }

    return order;
  }

  // ─── Huỷ đơn hàng (user tự huỷ) ─────────────────────────────────────
  async cancelOrder(orderId: string, userId: string): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // Chỉ cho huỷ khi đang pending hoặc confirmed
    // Không cho huỷ khi đang giao hoặc đã giao
    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new BadRequestException(
        `Không thể huỷ đơn hàng đang ở trạng thái "${order.status}"`,
      );
    }

    // Transaction: cập nhật status + hoàn lại stock
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Hoàn lại stock cho từng sản phẩm trong order
      for (const item of order.items) {
        await queryRunner.manager.increment(
          ProductEntity,
          { id: item.productId },
          'stock',
          item.quantity,
        );
      }

      // Cập nhật status thành CANCELLED
      order.status = OrderStatus.CANCELLED;
      await queryRunner.manager.save(OrderEntity, order);

      await queryRunner.commitTransaction();
      return order;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── [ADMIN] Lấy tất cả đơn hàng ────────────────────────────────────
  async findAllOrders(query: OrderQueryDto) {
    const { status, page = 1, limit = 10 } = query;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, lastPage: Math.ceil(total / limit) };
  }

  // ─── [ADMIN] Cập nhật trạng thái đơn hàng ────────────────────────────
  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    // Validate chuyển đổi trạng thái hợp lệ
    // Không cho phép chuyển ngược (ví dụ: delivered → pending)
    this.validateStatusTransition(order.status, dto.status);

    order.status = dto.status;

    // Nếu đánh dấu delivered → tự động đánh dấu là paid (với COD)
    if (dto.status === OrderStatus.DELIVERED) {
      order.isPaid = true;
    }

    return this.orderRepository.save(order);
  }

  // ─── Helper: validate chuyển đổi trạng thái hợp lệ ──────────────────
  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
  ): void {
    // Định nghĩa các chuyển đổi được phép
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [], // không chuyển được nữa
      [OrderStatus.CANCELLED]: [], // không chuyển được nữa
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Không thể chuyển từ "${current}" sang "${next}"`,
      );
    }
  }

  // ─── Helper: tạo mã đơn hàng duy nhất ────────────────────────────────
  // Format: ORD-YYYYMMDD-XXXXX (ví dụ: ORD-20240115-A3B2C)
  private generateOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    // Math.random + toString(36): tạo chuỗi random base36 (0-9, a-z)
    // slice(2, 7): lấy 5 ký tự ngẫu nhiên
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `ORD-${dateStr}-${random}`;
  }
}
