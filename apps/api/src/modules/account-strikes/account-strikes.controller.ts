import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccountStrikesService } from './account-strikes.service';
import { AppealStrikeDto } from './dto/appeal-strike.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Account Strikes')
@Controller()
export class AccountStrikesController {
  constructor(private readonly strikesService: AccountStrikesService) {}

  @Get('users/me/strikes')
  @ApiOperation({ summary: 'List my account strikes (community-guideline and copyright)' })
  listMine(@CurrentUser() user: JwtPayload) {
    return this.strikesService.listForUser(user.sub);
  }

  @Post('account-strikes/:id/appeal')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Appeal an active strike' })
  appeal(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppealStrikeDto,
  ) {
    return this.strikesService.submitAppeal(id, user.sub, dto.reason);
  }
}
