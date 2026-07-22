import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductEntity } from './infrastructure/product.entity';
import { CreateProductDto } from './dto/product.dto';

// ─── Mock Factories ───────────────────────────────────────────────────────────
const mockCommandBus = () => ({ execute: jest.fn() });
const mockQueryBus = () => ({ execute: jest.fn() });
const mockProductRepository = () => ({
  findOne: jest.fn(),
  decrement: jest.fn(),
  increment: jest.fn(),
});

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockProduct: Partial<ProductEntity> = {
  id: 'product-uuid-123',
  name: 'iPhone 15 Pro Max',
  slug: 'iphone-15-pro-max-1704067200000',
  price: 29990000,
  stock: 50,
  isActive: true,
  categoryId: 'category-uuid-456',
};

describe('ProductsService', () => {
  let service: ProductsService;
  let commandBus: jest.Mocked<ReturnType<typeof mockCommandBus>>;
  let queryBus: jest.Mocked<ReturnType<typeof mockQueryBus>>;
  let productRepository: jest.Mocked<ReturnType<typeof mockProductRepository>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: CommandBus, useFactory: mockCommandBus },
        { provide: QueryBus, useFactory: mockQueryBus },
        {
          provide: getRepositoryToken(ProductEntity),
          useFactory: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
    productRepository = module.get(getRepositoryToken(ProductEntity));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Test: create() ───────────────────────────────────────────────
  describe('create()', () => {
    const createDto: CreateProductDto = {
      name: 'iPhone 15 Pro Max',
      price: 29990000,
      stock: 50,
      categoryId: 'category-uuid-456',
    };

    it('nên dispatch CreateProductCommand qua CommandBus', async () => {
      // Arrange
      commandBus.execute.mockResolvedValue(mockProduct);

      // Act
      const result = await service.create(createDto);

      // Assert: kiểm tra CommandBus.execute được gọi
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockProduct);

      // Kiểm tra command được dispatch với đúng data
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createDto.name,
          price: createDto.price,
          categoryId: createDto.categoryId,
        }),
      );
    });
  });

  // ─── Test: findAll() ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('nên dispatch GetProductsQuery qua QueryBus', async () => {
      // Arrange
      const mockPaginatedResult = {
        data: [mockProduct],
        total: 1,
        page: 1,
        limit: 10,
        lastPage: 1,
        hasNextPage: false,
      };
      queryBus.execute.mockResolvedValue(mockPaginatedResult);

      // Act
      const filters = { page: 1, limit: 10 };
      const result = await service.findAll(filters);

      // Assert
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockPaginatedResult);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─── Test: findBySlug() ───────────────────────────────────────────
  describe('findBySlug()', () => {
    it('nên dispatch GetProductQuery và trả về product', async () => {
      // Arrange
      queryBus.execute.mockResolvedValue(mockProduct);

      // Act
      const result = await service.findBySlug('iphone-15-pro-max-1704067200000');

      // Assert
      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockProduct);
    });
  });

  // ─── Test: findById() ─────────────────────────────────────────────
  describe('findById()', () => {
    it('nên trả về product khi tìm thấy', async () => {
      // Arrange
      productRepository.findOne.mockResolvedValue(mockProduct as ProductEntity);

      // Act
      const result = await service.findById('product-uuid-123');

      // Assert
      expect(result).toEqual(mockProduct);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-uuid-123', isActive: true },
      });
    });

    it('nên throw NotFoundException khi product không tồn tại', async () => {
      // Arrange
      productRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Test: validateStock() ────────────────────────────────────────
  describe('validateStock()', () => {
    it('nên trả về product khi stock đủ', async () => {
      // Arrange: product có stock = 50
      productRepository.findOne.mockResolvedValue(mockProduct as ProductEntity);

      // Act: request 10 sản phẩm
      const result = await service.validateStock('product-uuid-123', 10);

      // Assert: đủ stock → trả về product
      expect(result).toEqual(mockProduct);
    });

    it('nên throw Error khi stock không đủ', async () => {
      // Arrange: product chỉ còn stock = 50
      productRepository.findOne.mockResolvedValue(mockProduct as ProductEntity);

      // Act: request 100 sản phẩm (vượt quá stock 50)
      await expect(
        service.validateStock('product-uuid-123', 100),
      ).rejects.toThrow(
        /chỉ còn 50 trong kho/,
        // regex: kiểm tra message chứa chuỗi này
      );
    });

    it('nên throw NotFoundException khi product không tồn tại', async () => {
      // Arrange
      productRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.validateStock('non-existent', 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test: decreaseStock() ────────────────────────────────────────
  describe('decreaseStock()', () => {
    it('nên gọi repository.decrement với đúng tham số', async () => {
      // Arrange
      productRepository.decrement.mockResolvedValue(undefined);

      // Act
      await service.decreaseStock('product-uuid-123', 5);

      // Assert: kiểm tra decrement được gọi đúng cách
      expect(productRepository.decrement).toHaveBeenCalledWith(
        { id: 'product-uuid-123' },
        'stock',
        5,
      );
    });
  });

  // ─── Test: increaseStock() ────────────────────────────────────────
  describe('increaseStock()', () => {
    it('nên gọi repository.increment để hoàn lại stock', async () => {
      // Arrange
      productRepository.increment.mockResolvedValue(undefined);

      // Act
      await service.increaseStock('product-uuid-123', 5);

      // Assert
      expect(productRepository.increment).toHaveBeenCalledWith(
        { id: 'product-uuid-123' },
        'stock',
        5,
      );
    });
  });
});
