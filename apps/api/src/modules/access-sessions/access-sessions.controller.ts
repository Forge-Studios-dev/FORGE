import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AccessSessionsService } from './access-sessions.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { StartAccessSessionDto, HeartbeatAccessSessionDto } from './dto/access-session.dto';

@ApiTags('Access Sessions')
@Controller('access-sessions')
export class AccessSessionsController {
  constructor(private readonly accessSessionsService: AccessSessionsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a premium content viewing session (one concurrent by default)' })
  start(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartAccessSessionDto,
    @Headers('x-device-fingerprint') deviceFingerprint?: string,
    @Req() req?: Request,
  ) {
    return this.accessSessionsService.startSession(user.sub, dto, {
      deviceFingerprint: deviceFingerprint ?? null,
      userAgent: req?.headers['user-agent'] ?? null,
    });
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Keep an access session alive' })
  heartbeat(@CurrentUser() user: JwtPayload, @Body() dto: HeartbeatAccessSessionDto) {
    return this.accessSessionsService.heartbeat(user.sub, dto.sessionToken);
  }

  @Delete('current')
  @ApiOperation({ summary: 'End the current access session' })
  end(@CurrentUser() user: JwtPayload, @Body() dto: HeartbeatAccessSessionDto) {
    return this.accessSessionsService.endSession(user.sub, dto.sessionToken, 'user_ended');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current active access session' })
  current(@CurrentUser() user: JwtPayload) {
    return this.accessSessionsService.getCurrentSession(user.sub);
  }
}
