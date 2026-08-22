import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudyGroup, StudyGroupMember, StudyGroupCheckIn } from './entities/study-group.entity';
import { StudyGroupsService } from './study-groups.service';
import { StudyGroupsController } from './study-groups.controller';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';

/**
 * Study & accountability groups (skill-economy). Controllers only register
 * when FEATURES_SKILL_ECONOMY_LMS=true (YouTube mode leaves this empty),
 * matching ChannelPointsModule/ArticlesModule/QaSessionsModule's gating
 * convention.
 */
@Module({})
export class StudyGroupsModule {
  static register(): DynamicModule {
    if (!isSkillEconomyLmsEnabled()) {
      return { module: StudyGroupsModule };
    }

    return {
      module: StudyGroupsModule,
      imports: [TypeOrmModule.forFeature([StudyGroup, StudyGroupMember, StudyGroupCheckIn])],
      providers: [StudyGroupsService, OptionalJwtAuthGuard],
      controllers: [StudyGroupsController],
      exports: [StudyGroupsService],
    };
  }
}
