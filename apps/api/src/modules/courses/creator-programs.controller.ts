import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatorProgramsService } from './creator-programs.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillFeatureGuard, RequireSkillFeature } from '../../common/guards/skill-feature.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreateProgramCheckoutDto } from './dto/create-program-checkout.dto';
import { ReservedCreatorIdPipe } from '../../common/pipes/reserved-creator-id.pipe';

@ApiTags('Creator Programs')
@Controller()
@UseGuards(SkillFeatureGuard)
@RequireSkillFeature('skillEconomyLms')
export class CreatorProgramsController {
  constructor(private readonly programsService: CreatorProgramsService) {}

  // Register `creators/me/*` before `creators/:creatorId/*` so `me` is not captured as an id.
  @Get('creators/me/programs')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List creator programs (multi-course)' })
  list(@CurrentUser() user: JwtPayload) {
    return this.programsService.listForCreator(user.sub);
  }

  @Post('creators/me/programs')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a program grouping courses' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name: string;
      description?: string;
      communityId?: string;
      isPublished?: boolean;
      courseIds?: string[];
      priceCents?: number;
    },
  ) {
    return this.programsService.createProgram(user.sub, body);
  }

  @Patch('creators/me/programs/:programId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a program' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('programId') programId: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      communityId?: string | null;
      isPublished?: boolean;
      priceCents?: number;
      stripePriceId?: string | null;
      courseIds?: string[];
    },
  ) {
    return this.programsService.updateProgram(user.sub, programId, body);
  }

  @Delete('creators/me/programs/:programId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a program' })
  delete(@CurrentUser() user: JwtPayload, @Param('programId') programId: string) {
    return this.programsService.deleteProgram(user.sub, programId);
  }

  @Post('programs/:programId/enroll')
  @ApiOperation({ summary: 'Enroll in all courses in a published program' })
  enroll(@CurrentUser() user: JwtPayload, @Param('programId') programId: string) {
    return this.programsService.enrollInProgram(user.sub, programId);
  }

  @Post('programs/:programId/checkout')
  @ApiOperation({ summary: 'Create Stripe checkout for a paid program' })
  checkout(
    @CurrentUser() user: JwtPayload,
    @Param('programId') programId: string,
    @Body() body: CreateProgramCheckoutDto,
  ) {
    return this.programsService.createProgramCheckout(user.sub, programId, body);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/programs')
  @ApiOperation({ summary: 'List published programs for a creator (consumer)' })
  listPublished(
    @Param('creatorId', ReservedCreatorIdPipe) creatorId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.programsService.listPublishedForCreator(creatorId, user?.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/programs/:slug')
  @ApiOperation({ summary: 'Get a published program by slug (consumer)' })
  getPublished(
    @Param('creatorId', ReservedCreatorIdPipe) creatorId: string,
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.programsService.getPublishedBySlug(creatorId, slug, user?.sub);
  }
}
