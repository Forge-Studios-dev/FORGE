import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './entities/article.entity';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EngagementModule } from '../engagement/engagement.module';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';

/**
 * Long-form text articles (skill-economy). Controllers only register when
 * FEATURES_SKILL_ECONOMY_LMS=true (YouTube mode leaves this empty), matching
 * ChannelPointsModule/PodcastsController's gating convention.
 */
@Module({})
export class ArticlesModule {
  static register(): DynamicModule {
    if (!isSkillEconomyLmsEnabled()) {
      return { module: ArticlesModule };
    }

    return {
      module: ArticlesModule,
      imports: [
        TypeOrmModule.forFeature([Article]),
        EntitlementsModule,
        EngagementModule,
        UsersModule,
      ],
      providers: [ArticlesService, CreatorApprovedGuard, OptionalJwtAuthGuard],
      controllers: [ArticlesController],
      exports: [ArticlesService],
    };
  }
}
