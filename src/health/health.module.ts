import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  // TerminusModule: cung cấp HealthCheckService và các health indicators
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
