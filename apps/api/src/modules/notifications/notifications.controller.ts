import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices/register')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Register FCM device token for push notifications' })
  registerDevice(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.notificationsService.registerDevice(user.sub, dto.platform, dto.fcmToken);
  }

  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Revoke FCM token (query fcmToken) or all devices for user' })
  revokeDevice(@CurrentUser() user: JwtPayload, @Query('fcmToken') fcmToken?: string) {
    return this.notificationsService.revokeDevice(user.sub, fcmToken);
  }

  @Get()
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'List notifications for current user' })
  list(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Post(':id/read')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Mark notification as read' })
  read(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id);
  }
}

