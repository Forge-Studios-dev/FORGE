import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CopyrightService } from './copyright.service';
import { SubmitCopyrightNoticeDto } from './dto/submit-notice.dto';
import { SubmitCounterNoticeDto } from './dto/submit-counter-notice.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Copyright')
@Controller('copyright')
export class CopyrightController {
  constructor(private readonly copyrightService: CopyrightService) {}

  @Post('notices')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Submit a DMCA takedown notice',
    description:
      'Anyone may file — a rights holder does not need a FORGE account. Rate-limited to deter abuse.',
  })
  submitNotice(@Body() dto: SubmitCopyrightNoticeDto) {
    return this.copyrightService.submitNotice(dto);
  }

  @Post('notices/:id/counter-notice')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'File a counter-notice as the uploader of the taken-down video' })
  submitCounterNotice(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitCounterNoticeDto,
  ) {
    return this.copyrightService.submitCounterNotice(id, user.sub, dto);
  }
}
