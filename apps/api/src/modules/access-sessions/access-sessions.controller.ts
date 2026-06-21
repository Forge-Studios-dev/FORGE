import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { createHash } from 'crypto';
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
  heartbeat(
    @CurrentUser() user: JwtPayload,
    @Body() dto: HeartbeatAccessSessionDto,
    @Headers('x-device-fingerprint') deviceFingerprint?: string,
    @Req() req?: Request,
  ) {
    const ua = req?.headers['user-agent'] ?? '';
    const derived = deviceFingerprint
      ? createHash('sha256').update(`${deviceFingerprint}|${ua}`).digest('hex').slice(0, 64)
      : null;
    return this.accessSessionsService.heartbeat(user.sub, dto.sessionToken, derived);
  }

  @Delete('current')
  @ApiOperation({ summary: 'End the current access session' })
  end(@CurrentUser() user: JwtPayload, @Body() dto: HeartbeatAccessSessionDto) {
    return this.accessSessionsService.endSession(user.sub, dto.sessionToken, 'user_ended');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current active access session summary' })
  current(@CurrentUser() user: JwtPayload) {
    return this.accessSessionsService.getCurrentSession(user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all active premium access sessions for the user' })
  list(@CurrentUser() user: JwtPayload) {
    return this.accessSessionsService.listSessions(user.sub);
  }

  @Delete(':sessionToken')
  @ApiOperation({ summary: 'Revoke a specific access session by token' })
  revoke(
    @CurrentUser() user: JwtPayload,
    @Param('sessionToken') sessionToken: string,
  ) {
    return this.accessSessionsService.endSession(user.sub, sessionToken, 'user_revoked');
  }
}
