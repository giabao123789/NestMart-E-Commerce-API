import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartEntity } from './entities/cart.entity';
import { CartItemEntity } from './entities/cart-item.entity';
import { ProductsService } from '../products/products.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  CartSummary,
  CartItemSummary,
} from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepository: Repository<CartEntity>,

    @InjectRepository(CartItemEntity)
    private readonly cartItemRepository: Repository<CartItemEntity>,

    // Inject ProductsService để validate stock khi thêm vào giỏ
    private readonly productsService: ProductsService,
  ) {}

  // ─── Lấy hoặc tạo cart cho user ──────────────────────────────────────
  // Pattern: "Get or Create" — nếu chưa có cart thì tạo mới
  // Đảm bảo mỗi user luôn có đúng 1 cart
  private async getOrCreateCart(userId: string): Promise<CartEntity> {
    let cart = await this.cartRepository.findOne({
      where: { userId },
      // relations: load items và product của mỗi item
      relations: { items: { product: true } },
    });

    if (!cart) {
      // Tạo cart mới cho user lần đầu tiên
      cart = this.cartRepository.create({ userId });
      await this.cartRepository.save(cart);

      // Load lại với relations sau khi save
      cart = await this.cartRepository.findOne({
        where: { userId },
        relations: { items: { product: true } },
      });
    }

    return cart!;
  }

  // ─── Lấy giỏ hàng của user (format đẹp) ─────────────────────────────
  async getCart(userId: string): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId);
    return this.formatCartSummary(cart);
  }

  // ─── Thêm sản phẩm vào giỏ ───────────────────────────────────────────
  async addToCart(userId: string, dto: AddToCartDto): Promise<CartSummary> {
    const { productId, quantity } = dto;

    // Bước 1: Validate sản phẩm tồn tại và còn đủ stock
    const product = await this.productsService.validateStock(productId, quantity);

    // Bước 2: Lấy hoặc tạo cart
    const cart = await this.getOrCreateCart(userId);

    // Bước 3: Kiểm tra sản phẩm đã có trong giỏ chưa
    const existingItem = cart.items?.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      // Sản phẩm đã có → cộng thêm số lượng
      const newQuantity = existingItem.quantity + quantity;

      // Validate tổng số lượng mới không vượt quá stock
      if (newQuantity > product.stock) {
        throw new BadRequestException(
          `Chỉ còn ${product.stock} sản phẩm trong kho. Giỏ hàng của bạn đã có ${existingItem.quantity}.`,
        );
      }

      existingItem.quantity = newQuantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      // Sản phẩm chưa có → thêm item mới vào giỏ
      const newItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
      });
      await this.cartItemRepository.save(newItem);
    }

    // Load lại cart với data mới nhất
    const updatedCart = await this.getOrCreateCart(userId);
    return this.formatCartSummary(updatedCart);
  }

  // ─── Cập nhật số lượng item trong giỏ ────────────────────────────────
  async updateCartItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartSummary> {
    // Tìm item và đảm bảo nó thuộc về cart của user này
    // JOIN với cart để verify ownership (quyền sở hữu)
    const item = await this.cartItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.cart', 'cart')
      .where('item.id = :itemId', { itemId })
      .andWhere('cart.userId = :userId', { userId })
      .getOne();

    if (!item) {
      throw new NotFoundException(
        'Không tìm thấy item trong giỏ hàng của bạn',
      );
    }

    // Validate stock với số lượng mới
    await this.productsService.validateStock(item.productId, dto.quantity);

    item.quantity = dto.quantity;
    await this.cartItemRepository.save(item);

    const updatedCart = await this.getOrCreateCart(userId);
    return this.formatCartSummary(updatedCart);
  }

  // ─── Xoá 1 item khỏi giỏ ─────────────────────────────────────────────
  async removeCartItem(userId: string, itemId: string): Promise<CartSummary> {
    const item = await this.cartItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.cart', 'cart')
      .where('item.id = :itemId', { itemId })
      .andWhere('cart.userId = :userId', { userId })
      .getOne();

    if (!item) {
      throw new NotFoundException(
        'Không tìm thấy item trong giỏ hàng của bạn',
      );
    }

    await this.cartItemRepository.remove(item);

    const updatedCart = await this.getOrCreateCart(userId);
    return this.formatCartSummary(updatedCart);
  }

  // ─── Xoá toàn bộ giỏ hàng ────────────────────────────────────────────
  async clearCart(userId: string): Promise<{ message: string }> {
    const cart = await this.getOrCreateCart(userId);

    // Xoá tất cả items của cart này
    // DELETE FROM cart_items WHERE cart_id = '...'
    await this.cartItemRepository.delete({ cartId: cart.id });

    return { message: 'Đã xoá toàn bộ giỏ hàng' };
  }

  // ─── Lấy cart entity thô (dùng nội bộ cho OrdersService) ─────────────
  // OrdersService cần cart entity để tạo order items
  async getCartEntity(userId: string): Promise<CartEntity> {
    return this.getOrCreateCart(userId);
  }

  // ─── Format CartEntity → CartSummary (response đẹp cho client) ───────
  // Tính toán totalItems, totalQuantity, totalPrice
  private formatCartSummary(cart: CartEntity): CartSummary {
    const items: CartItemSummary[] = (cart.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || '',
      productPrice: Number(item.product?.price || 0),
      productImage: item.product?.imageUrl || '',
      quantity: item.quantity,
      // subtotal: giá tạm tính của item này
      subtotal: Number(item.product?.price || 0) * item.quantity,
    }));

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      totalItems: items.length,     // số loại sản phẩm khác nhau
      totalQuantity,                 // tổng số lượng tất cả
      totalPrice,                    // tổng tiền
    };
  }
}
