import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Courses')
@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('creators/me/courses')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List creator courses' })
  list(@CurrentUser() user: JwtPayload) {
    return this.coursesService.listForCreator(user.sub);
  }

  @Post('creators/me/courses')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a course' })
  create(@CurrentUser() user: JwtPayload, @Body() body: { title: string; description?: string }) {
    return this.coursesService.createCourse(user.sub, body);
  }

  @Patch('creators/me/courses/:courseId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a course (publish, title, description)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: { title?: string; description?: string; isPublished?: boolean },
  ) {
    return this.coursesService.updateCourse(user.sub, courseId, body);
  }

  @Post('creators/me/courses/:courseId/cohorts')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a course cohort' })
  createCohort(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: { name: string },
  ) {
    return this.coursesService.createCohort(user.sub, courseId, body);
  }

  @Post('creators/me/courses/:courseId/lessons')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a course lesson' })
  createLesson(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body()
    body: { title: string; content?: string; sortOrder?: number; durationMinutes?: number },
  ) {
    return this.coursesService.createLesson(user.sub, courseId, body);
  }

  @Get('courses/:courseId/lessons')
  @ApiOperation({ summary: 'List course lessons' })
  listLessons(@CurrentUser() user: JwtPayload, @Param('courseId') courseId: string) {
    return this.coursesService.listLessons(courseId, user.sub);
  }

  @Post('courses/:courseId/enroll')
  @ApiOperation({ summary: 'Enroll in a course' })
  enroll(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: { cohortId?: string },
  ) {
    return this.coursesService.enroll(user.sub, courseId, body.cohortId);
  }

  @Get('courses/:courseId/progress')
  @ApiOperation({ summary: 'Get course progress' })
  progress(@CurrentUser() user: JwtPayload, @Param('courseId') courseId: string) {
    return this.coursesService.getProgress(user.sub, courseId);
  }

  @Post('courses/:courseId/lessons/:lessonId/progress')
  @ApiOperation({ summary: 'Update lesson progress' })
  updateProgress(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: { progressPercent: number },
  ) {
    return this.coursesService.updateLessonProgress(
      user.sub,
      courseId,
      lessonId,
      body.progressPercent,
    );
  }
}
