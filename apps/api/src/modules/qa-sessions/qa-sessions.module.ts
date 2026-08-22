import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QaSession, QaQuestion, QaQuestionUpvote } from './entities/qa-session.entity';
import { QaSessionsService } from './qa-sessions.service';
import { QaSessionsController } from './qa-sessions.controller';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';

/**
 * Q&A sessions (skill-economy). Controllers only register when
 * FEATURES_SKILL_ECONOMY_LMS=true (YouTube mode leaves this empty), matching
 * ChannelPointsModule/ArticlesModule's gating convention.
 */
@Module({})
export class QaSessionsModule {
  static register(): DynamicModule {
    if (!isSkillEconomyLmsEnabled()) {
      return { module: QaSessionsModule };
    }

    return {
      module: QaSessionsModule,
      imports: [TypeOrmModule.forFeature([QaSession, QaQuestion, QaQuestionUpvote])],
      providers: [QaSessionsService, CreatorApprovedGuard, OptionalJwtAuthGuard],
      controllers: [QaSessionsController],
      exports: [QaSessionsService],
    };
  }
}
