import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course, CourseCohort } from './entities/course.entity';
import {
  CourseEnrollment,
  CourseLesson,
  CourseLessonProgress,
} from './entities/course-lms.entity';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { UsersModule } from '../users/users.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AccessSessionsModule } from '../access-sessions/access-sessions.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      CourseCohort,
      CourseLesson,
      CourseEnrollment,
      CourseLessonProgress,
    ]),
    UsersModule,
    EntitlementsModule,
    AccessSessionsModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CreatorApprovedGuard],
  exports: [CoursesService],
})
export class CoursesModule {}
