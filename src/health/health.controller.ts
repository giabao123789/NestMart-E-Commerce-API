import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    // HealthCheckService: service điều phối các health indicator
    private health: HealthCheckService,
    // TypeOrmHealthIndicator: kiểm tra kết nối database
    private db: TypeOrmHealthIndicator,
    // MemoryHealthIndicator: kiểm tra RAM
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @Public()         // health check không cần auth — load balancer cần gọi được
  @HealthCheck()    // decorator của @nestjs/terminus
  @ApiOperation({ summary: 'Kiểm tra sức khoẻ hệ thống' })
  check() {
    return this.health.check([
      // Ping database — nếu DB down thì trả về status 'down'
      () => this.db.pingCheck('database'),

      // Heap memory (bộ nhớ heap) không vượt quá 300MB
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
