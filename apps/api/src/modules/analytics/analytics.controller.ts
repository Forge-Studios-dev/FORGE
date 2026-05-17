import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { IngestEventDto } from './dto/ingest-event.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('events')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ingest client analytics event (optional Bearer for attribution)' })
  async ingest(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: IngestEventDto,
  ) {
    let userId: string | null = null;
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (bearer) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(bearer, {
          secret: this.configService.get<string>('jwt.secret'),
        });
        userId = payload.sub;
      } catch {
        // ignore invalid token for optional attribution
      }
    }
    await this.analyticsService.ingest(userId, dto);
  }
}
