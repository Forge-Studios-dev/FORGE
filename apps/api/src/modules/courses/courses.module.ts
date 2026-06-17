import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course, CourseCohort } from './entities/course.entity';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseCohort]), UsersModule],
  controllers: [CoursesController],
  providers: [CoursesService, CreatorApprovedGuard],
  exports: [CoursesService],
})
export class CoursesModule {}
