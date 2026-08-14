import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudAlertStatus, FraudSignal } from './entities/fraud-alert.entity';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';

class UpdateFraudAlertDto {
  @ApiProperty({ enum: FraudAlertStatus })
  @IsEnum(FraudAlertStatus)
  status: FraudAlertStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

@ApiTags('Fraud Detection')
@Controller('admin/fraud')
export class FraudDetectionController {
  constructor(private readonly fraudService: FraudDetectionService) {}

  @Get('alerts')
  @Permissions(Permission.MANAGE_PLATFORM)
  @ApiOperation({ summary: 'List fraud alerts (admin)' })
  listAlerts(
    @Query('status') status?: FraudAlertStatus,
    @Query('signal') signal?: FraudSignal,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.fraudService.listAlerts({
      status,
      signal,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get('users/:userId/risk')
  @Permissions(Permission.MANAGE_PLATFORM)
  @ApiOperation({ summary: 'Get risk profile for a user (admin)' })
  getUserRisk(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.fraudService.getUserRiskProfile(userId);
  }

  @Post('users/:userId/check')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.MANAGE_PLATFORM)
  @ApiOperation({ summary: 'Run fraud checks on a user on demand (admin)' })
  runCheck(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.fraudService.runManualCheck(userId);
  }

  @Patch('alerts/:alertId')
  @Permissions(Permission.MANAGE_PLATFORM)
  @ApiOperation({ summary: 'Update fraud alert status and notes (admin)' })
  updateAlert(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() body: UpdateFraudAlertDto,
  ) {
    return this.fraudService.updateAlertStatus(alertId, body.status, body.notes).then(() => ({ ok: true }));
  }
}
