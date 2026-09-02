import { DynamicModule, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course, CourseBundleItem, CourseCohort } from './entities/course.entity';
import { Community } from '../communities/entities/community.entity';
import { User } from '../users/entities/user.entity';
import {
  CourseCertificate,
  CourseEnrollment,
  CourseLesson,
  CourseLessonProgress,
} from './entities/course-lms.entity';
import {
  CourseQuiz,
  CourseQuizAttempt,
  CourseAssignment,
  CourseAssignmentSubmission,
} from './entities/course-quiz.entity';
import { Video } from '../content/entities/video.entity';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CreatorProgramsController } from './creator-programs.controller';
import { CreatorProgramsService } from './creator-programs.service';
import { UsersModule } from '../users/users.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AccessSessionsModule } from '../access-sessions/access-sessions.module';
import { EngagementModule } from '../engagement/engagement.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { isCoursesEnabled } from '../../common/features/skill-platform';
import { SkillFeatureGuard } from '../../common/guards/skill-feature.guard';
import { ProgramPurchase } from './entities/program-purchase.entity';
import { ProgramPurchaseListener } from './program-purchase.listener';
import { BillingModule } from '../billing/billing.module';

/**
 * Courses (video-lesson collections). Registers when FEATURES_COURSES=true
 * or FEATURES_SKILL_ECONOMY_LMS=true (full LMS).
 */
@Module({})
export class CoursesModule {
  static register(): DynamicModule {
    if (!isCoursesEnabled()) {
      return {
        module: CoursesModule,
      };
    }

    return {
      module: CoursesModule,
      imports: [
        TypeOrmModule.forFeature([
          Course,
          CourseCohort,
          CourseBundleItem,
          CourseLesson,
          CourseEnrollment,
          CourseLessonProgress,
          CourseCertificate,
          CourseQuiz,
          CourseQuizAttempt,
          CourseAssignment,
          CourseAssignmentSubmission,
          Community,
          User,
          Video,
          ProgramPurchase,
        ]),
        forwardRef(() => UsersModule),
        forwardRef(() => EntitlementsModule),
        forwardRef(() => AccessSessionsModule),
        forwardRef(() => EngagementModule),
        forwardRef(() => BillingModule),
      ],
      controllers: [CoursesController, CreatorProgramsController],
      providers: [
        CoursesService,
        CreatorProgramsService,
        CreatorApprovedGuard,
        SkillFeatureGuard,
        ProgramPurchaseListener,
      ],
      exports: [CoursesService, CreatorProgramsService],
    };
  }
}
