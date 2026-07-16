import { Module } from '@nestjs/common';
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
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
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
    ]),
    UsersModule,
    EntitlementsModule,
    AccessSessionsModule,
  ],
  controllers: [CoursesController, CreatorProgramsController],
  providers: [CoursesService, CreatorProgramsService, CreatorApprovedGuard],
  exports: [CoursesService, CreatorProgramsService],
})
export class CoursesModule {}
