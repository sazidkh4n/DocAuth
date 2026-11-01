import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health & Diagnostics')
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Overall platform health and component diagnostics' })
  @ApiResponse({ status: 200, description: 'Overall system health report' })
  async getOverallHealth() {
    return this.healthService.getOverallHealth();
  }

  @Get('database')
  @ApiOperation({ summary: 'PostgreSQL connection status and query latency' })
  @ApiResponse({ status: 200, description: 'Database health' })
  async getDatabaseHealth() {
    return this.healthService.getDatabaseHealth();
  }

  @Get('blockchain')
  @ApiOperation({ summary: 'Polygon PoS RPC node latency and latest block number' })
  @ApiResponse({ status: 200, description: 'Polygon node health' })
  async getBlockchainHealth() {
    return this.healthService.getBlockchainHealth();
  }

  @Get('storage')
  @ApiOperation({ summary: 'MinIO / S3 object storage accessibility and bucket status' })
  @ApiResponse({ status: 200, description: 'Object storage health' })
  async getStorageHealth() {
    return this.healthService.getStorageHealth();
  }
}

