import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { UsersService } from '../../modules/users/users.service';
import { CategoriesService } from '../../modules/categories/categories.service';
import { ProductsService } from '../../modules/products/products.service';
import { UserRole } from '../../modules/users/infrastructure/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../../modules/users/infrastructure/user.entity';
import { Repository } from 'typeorm';

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Script này tạo dữ liệu mẫu cho môi trường development và demo
// Chạy: npx ts-node src/database/seeds/seed.ts
//   hoặc: npm run seed

async function seed() {
  console.log('🌱 Bắt đầu tạo seed data...\n');

  // Khởi động NestJS app để dùng services
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'], // chỉ log error để output gọn
  });

  const usersService = app.get(UsersService);
  const categoriesService = app.get(CategoriesService);
  const productsService = app.get(ProductsService);
  const userRepository = app.get<Repository<UserEntity>>(
    getRepositoryToken(UserEntity),
  );

  try {
    // ─── 1. Tạo Admin Account ──────────────────────────────────────
    console.log('👤 Tạo admin account...');
    let adminUser;
    try {
      adminUser = await usersService.create({
        name: 'NestMart Admin',
        email: 'admin@nestmart.com',
        password: 'Admin123!',
      });

      // Cập nhật role thành ADMIN trực tiếp qua repository
      // UsersService.create() không cho set role (bảo mật)
      await userRepository.update(adminUser.id, { role: UserRole.ADMIN });
      console.log('✅ Admin: admin@nestmart.com / Admin123!');
    } catch {
      console.log('⏭️  Admin đã tồn tại, bỏ qua...');
    }

    // ─── 2. Tạo User thường ────────────────────────────────────────
    console.log('\n👤 Tạo user accounts...');
    const testUsers = [
      { name: 'Trần Gia Bảo', email: 'bao@gmail.com', password: 'User123!' },
      { name: 'Nguyễn Văn A', email: 'user2@gmail.com', password: 'User123!' },
    ];

    for (const userData of testUsers) {
      try {
        await usersService.create(userData);
        console.log(`✅ User: ${userData.email}`);
      } catch {
        console.log(`⏭️  ${userData.email} đã tồn tại`);
      }
    }

    // ─── 3. Tạo Categories ─────────────────────────────────────────
    console.log('\n📂 Tạo categories...');
    const categoriesData = [
      {
        name: 'Điện Thoại & Phụ Kiện',
        description: 'Điện thoại, ốp lưng, sạc, tai nghe...',
      },
      {
        name: 'Laptop & Máy Tính',
        description: 'Laptop, PC, màn hình, bàn phím...',
      },
      {
        name: 'Thời Trang Nam',
        description: 'Áo, quần, giày dép nam...',
      },
      {
        name: 'Thời Trang Nữ',
        description: 'Áo, váy, túi xách, giày nữ...',
      },
      {
        name: 'Đồ Gia Dụng',
        description: 'Tủ lạnh, máy giặt, nồi cơm điện...',
      },
      {
        name: 'Sách & Văn Phòng Phẩm',
        description: 'Sách, bút, vở, dụng cụ văn phòng...',
      },
    ];

    const createdCategories: Record<string, string> = {};
    for (const catData of categoriesData) {
      try {
        const category = await categoriesService.create(catData);
        createdCategories[catData.name] = category.id;
        console.log(`✅ Category: ${catData.name} (slug: ${category.slug})`);
      } catch {
        // Category đã tồn tại → tìm lại để lấy id
        try {
          const existing = await categoriesService.findAll();
          const found = existing.find((c) => c.name === catData.name);
          if (found) createdCategories[catData.name] = found.id;
        } catch {}
        console.log(`⏭️  ${catData.name} đã tồn tại`);
      }
    }

    // ─── 4. Tạo Products ───────────────────────────────────────────
    console.log('\n📦 Tạo products...');
    const phoneCatId = createdCategories['Điện Thoại & Phụ Kiện'];
    const laptopCatId = createdCategories['Laptop & Máy Tính'];
    const fashionManCatId = createdCategories['Thời Trang Nam'];

    const productsData = [
      // Điện thoại
      {
        name: 'iPhone 15 Pro Max 256GB',
        price: 29990000,
        stock: 50,
        categoryId: phoneCatId,
        description:
          'iPhone 15 Pro Max với chip A17 Pro, camera 48MP, thiết kế Titanium cao cấp.',
        imageUrl: 'https://placehold.co/400x400?text=iPhone+15+Pro+Max',
      },
      {
        name: 'Samsung Galaxy S24 Ultra',
        price: 26990000,
        stock: 35,
        categoryId: phoneCatId,
        description:
          'Galaxy S24 Ultra với bút S Pen tích hợp, AI Galaxy, màn hình 6.8 inch Dynamic AMOLED.',
        imageUrl: 'https://placehold.co/400x400?text=S24+Ultra',
      },
      {
        name: 'Xiaomi 14 Pro',
        price: 18990000,
        stock: 40,
        categoryId: phoneCatId,
        description:
          'Xiaomi 14 Pro với camera Leica, Snapdragon 8 Gen 3, sạc nhanh 120W.',
        imageUrl: 'https://placehold.co/400x400?text=Xiaomi+14+Pro',
      },
      {
        name: 'OPPO Find X7 Ultra',
        price: 21990000,
        stock: 25,
        categoryId: phoneCatId,
        description: 'OPPO Find X7 Ultra với camera Hasselblad, zoom quang học 6x.',
        imageUrl: 'https://placehold.co/400x400?text=OPPO+Find+X7',
      },

      // Laptop
      {
        name: 'MacBook Pro M3 14 inch',
        price: 49990000,
        stock: 20,
        categoryId: laptopCatId,
        description:
          'MacBook Pro M3 với màn hình Liquid Retina XDR, pin 22 giờ, chip M3 mạnh mẽ.',
        imageUrl: 'https://placehold.co/400x400?text=MacBook+Pro+M3',
      },
      {
        name: 'Dell XPS 15 9530',
        price: 42990000,
        stock: 15,
        categoryId: laptopCatId,
        description:
          'Dell XPS 15 với Intel Core i9, RTX 4070, màn hình OLED 3.5K.',
        imageUrl: 'https://placehold.co/400x400?text=Dell+XPS+15',
      },
      {
        name: 'Asus ROG Zephyrus G14',
        price: 35990000,
        stock: 18,
        categoryId: laptopCatId,
        description:
          'Laptop gaming Asus ROG với AMD Ryzen 9, RTX 4060, màn hình 165Hz.',
        imageUrl: 'https://placehold.co/400x400?text=ROG+G14',
      },

      // Thời trang nam
      {
        name: 'Áo Polo Nam Lacoste Classic Fit',
        price: 1890000,
        stock: 100,
        categoryId: fashionManCatId,
        description: 'Áo polo Lacoste chất liệu cotton piqué cao cấp, nhiều màu sắc.',
        imageUrl: 'https://placehold.co/400x400?text=Polo+Lacoste',
      },
      {
        name: 'Quần Jeans Levi\'s 511 Slim',
        price: 1590000,
        stock: 80,
        categoryId: fashionManCatId,
        description: 'Quần jeans Levi\'s 511 form slim fit, chất liệu denim co giãn.',
        imageUrl: 'https://placehold.co/400x400?text=Levis+511',
      },
    ];

    let productCount = 0;
    for (const productData of productsData) {
      if (!productData.categoryId) {
        console.log(`⏭️  Bỏ qua product không có categoryId`);
        continue;
      }
      try {
        const product = await productsService.create(productData);
        productCount++;
        console.log(
          `✅ Product: ${product.name} - ${product.price.toLocaleString('vi-VN')}₫`,
        );
      } catch (error) {
        console.log(`⏭️  ${productData.name}: ${error.message}`);
      }
    }

    // ─── Summary ───────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Seed data hoàn thành!');
    console.log('='.repeat(50));
    console.log(`✅ Categories: ${Object.keys(createdCategories).length}`);
    console.log(`✅ Products: ${productCount}`);
    console.log('\n📌 Tài khoản test:');
    console.log('   Admin: admin@nestmart.com / Admin123!');
    console.log('   User : bao@gmail.com / User123!');
    console.log('\n🔗 Swagger UI: http://localhost:3000/docs');
    console.log('🔗 Health    : http://localhost:3000/api/health');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Seed thất bại:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

seed();
