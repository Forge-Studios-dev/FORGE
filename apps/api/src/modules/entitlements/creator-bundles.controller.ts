import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatorBundlesService } from './creator-bundles.service';
import { CreateBundleDto, UpdateBundleDto } from './dto/bundle.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

/** LMS-only product bundles. Mounted only when FEATURES_SKILL_ECONOMY_LMS=true. */
@ApiTags('Creator Bundles')
@Controller()
@UseGuards(SkillEconomyLmsGuard)
export class CreatorBundlesController {
  constructor(private readonly creatorBundlesService: CreatorBundlesService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/bundles')
  @ApiOperation({ summary: 'List active product bundles for a creator' })
  listPublicBundles(
    @Param('creatorId') creatorId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.creatorBundlesService.listPublic(creatorId, user?.sub);
  }

  @Get('creators/me/bundles')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List creator product bundles' })
  listMyBundles(@CurrentUser() user: JwtPayload) {
    return this.creatorBundlesService.listForCreator(user.sub);
  }

  @Post('creators/me/bundles')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a product bundle (syncs tier entitlements)' })
  createBundle(@CurrentUser() user: JwtPayload, @Body() dto: CreateBundleDto) {
    return this.creatorBundlesService.create(user.sub, dto);
  }

  @Patch('creators/me/bundles/:bundleId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a product bundle' })
  updateBundle(
    @CurrentUser() user: JwtPayload,
    @Param('bundleId') bundleId: string,
    @Body() dto: UpdateBundleDto,
  ) {
    return this.creatorBundlesService.update(user.sub, bundleId, dto);
  }

  @Delete('creators/me/bundles/:bundleId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Deactivate a product bundle' })
  deactivateBundle(@CurrentUser() user: JwtPayload, @Param('bundleId') bundleId: string) {
    return this.creatorBundlesService.deactivate(user.sub, bundleId);
  }
}
