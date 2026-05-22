import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { parseFeatureFlags } from '@forge/shared-types';

@ApiTags('Platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Public platform config (feature flags, no secrets)' })
  getPublicConfig() {
    const raw = this.configService.get<string>('featureFlags') || '';
    const featureFlags = parseFeatureFlags(raw);
    return {
      featureFlags,
      apiVersion: 'v1',
    };
  }
}
