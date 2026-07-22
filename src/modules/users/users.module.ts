import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './infrastructure/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    // TypeOrmModule.forFeature([UserEntity]):
    // Đăng ký UserEntity cho module này
    // → NestJS tạo Repository<UserEntity> và cho phép inject bằng @InjectRepository(UserEntity)
    // → autoLoadEntities: true trong AppModule sẽ tự load Entity này vào TypeORM
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  // exports: [UsersService] → AuthModule có thể inject UsersService
  // Nếu không export → AuthModule import UsersModule vẫn không dùng được UsersService
  exports: [UsersService],
})
export class UsersModule {}