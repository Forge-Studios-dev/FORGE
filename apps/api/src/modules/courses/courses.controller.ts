import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillFeatureGuard, RequireSkillFeature } from '../../common/guards/skill-feature.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreateCohortDto, UpdateCohortDto } from './dto/cohort.dto';
import { LessonType } from './entities/course-lms.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { clampLimit } from '../../common/utils/pagination.util';
import { ReservedCreatorIdPipe } from '../../common/pipes/reserved-creator-id.pipe';
import { isSkillEconomyLmsExtendedEnabled } from '../../common/features/skill-platform';

@ApiTags('Courses')
@Controller()
@UseGuards(SkillFeatureGuard)
@RequireSkillFeature('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Roles(UserRole.ADMIN)
  @Get('admin/courses/overview')
  @ApiOperation({ summary: 'Platform courses overview (admin)' })
  adminCoursesOverview(@Query('limit') limit = 50) {
    return this.coursesService.adminCoursesOverview(clampLimit(Number(limit) || 50, 50, 100));
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('courses/discover/featured')
  @ApiOperation({ summary: 'List featured published courses (public catalog)' })
  listFeatured(@Query('limit') limit = 12, @CurrentUser() user?: JwtPayload) {
    return this.coursesService.listFeaturedCourses(Number(limit) || 12, user?.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('courses/discover')
  @ApiOperation({ summary: 'Search published courses (public catalog)' })
  discover(
    @Query('q') q = '',
    @Query('limit') limit = 20,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.coursesService.discoverCourses(q, Number(limit) || 20, user?.sub);
  }

  @Get('creators/me/courses')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List creator courses' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.listForCreator(user.sub, { page, limit });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('creators/:creatorId/courses')
  @ApiOperation({ summary: 'List published courses for a creator (public catalog)' })
  listCreatorPublished(
    @Param('creatorId', ReservedCreatorIdPipe) creatorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.coursesService.listPublishedForCreator(creatorId, user?.sub, { page, limit });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('courses/:courseId/catalog')
  @ApiOperation({ summary: 'Get published course catalog metadata' })
  getCatalog(@Param('courseId') courseId: string, @CurrentUser() user?: JwtPayload) {
    return this.coursesService.getPublicCourse(courseId, user?.sub);
  }

  @Public()
  @Get('courses/:courseId/catalog/lessons')
  @ApiOperation({ summary: 'Public course syllabus (titles only, no content)' })
  getCatalogLessons(@Param('courseId') courseId: string) {
    return this.coursesService.listPublicCatalogLessons(courseId);
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
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Create a course cohort (optional start/end window)' })
  createCohort(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: CreateCohortDto,
  ) {
    return this.coursesService.createCohort(user.sub, courseId, body);
  }

  @Patch('creators/me/courses/:courseId/cohorts/:cohortId')
  @UseGuards(CreatorApprovedGuard)
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Update a cohort (name and/or start/end window)' })
  updateCohort(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Param('cohortId') cohortId: string,
    @Body() body: UpdateCohortDto,
  ) {
    return this.coursesService.updateCohort(user.sub, courseId, cohortId, body);
  }

  @Get('creators/me/courses/:courseId/cohorts')
  @UseGuards(CreatorApprovedGuard)
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'List course cohorts' })
  listCohorts(@CurrentUser() user: JwtPayload, @Param('courseId') courseId: string) {
    return this.coursesService.listCohorts(user.sub, courseId);
  }

  @Patch('creators/me/courses/:courseId/lessons/reorder')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Reorder course lessons' })
  reorderLessons(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: { lessonIds: string[] },
  ) {
    return this.coursesService.reorderLessons(user.sub, courseId, body.lessonIds ?? []);
  }

  @Post('creators/me/courses/:courseId/bind-community')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Bind course to community (auto-provision if omitted)' })
  bindCommunity(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: { communityId?: string },
  ) {
    return this.coursesService.bindCourseCommunity(user.sub, courseId, body.communityId);
  }

  @Post('creators/me/courses/:courseId/lessons')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a course lesson (text or video)' })
  createLesson(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body()
    body: {
      title: string;
      content?: string;
      sortOrder?: number;
      durationMinutes?: number;
      lessonType?: LessonType;
      videoId?: string;
    },
  ) {
    return this.coursesService.createLesson(user.sub, courseId, body);
  }

  @Patch('creators/me/courses/:courseId/lessons/:lessonId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a course lesson' })
  updateLesson(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      sortOrder?: number;
      durationMinutes?: number;
      lessonType?: LessonType;
      videoId?: string | null;
    },
  ) {
    return this.coursesService.updateLesson(user.sub, courseId, lessonId, body);
  }

  @Delete('creators/me/courses/:courseId/lessons/:lessonId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Delete a course lesson' })
  deleteLesson(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.deleteLesson(user.sub, courseId, lessonId);
  }

  @Get('courses/:courseId/lessons')
  @ApiOperation({ summary: 'List course lessons (with video metadata)' })
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
    const cohortId = isSkillEconomyLmsExtendedEnabled() ? body.cohortId : undefined;
    return this.coursesService.enroll(user.sub, courseId, cohortId);
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

  @Post('courses/:courseId/certificate')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Issue completion certificate (requires 100% lesson completion)' })
  issueCertificate(@CurrentUser() user: JwtPayload, @Param('courseId') courseId: string) {
    return this.coursesService.issueCertificate(user.sub, courseId);
  }

  @Get('me/certificates')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'List my earned certificates' })
  myCertificates(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.getMyCertificates(user.sub, { page, limit });
  }

  @Public()
  @Get('certificates/:certificateId')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Get certificate by ID (public)' })
  getCertificate(@Param('certificateId') certificateId: string) {
    return this.coursesService.getCertificate(certificateId);
  }

  // ── Quizzes ────────────────────────────────────────────────────────────────

  @Post('courses/:courseId/quizzes')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Create a quiz for a course (creator only)' })
  createQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: Parameters<CoursesService['createQuiz']>[2],
  ) {
    return this.coursesService.createQuiz(user.sub, courseId, body);
  }

  @Get('courses/:courseId/quizzes')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'List quizzes for a course' })
  listQuizzes(@CurrentUser() user: JwtPayload, @Param('courseId') courseId: string) {
    return this.coursesService.listQuizzes(user.sub, courseId);
  }

  @Post('quizzes/:quizId/submit')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Submit quiz answers' })
  submitQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('quizId') quizId: string,
    @Body() body: { answers: Array<string | number> },
  ) {
    return this.coursesService.submitQuiz(user.sub, quizId, body.answers);
  }

  @Get('quizzes/:quizId/my-attempts')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Get my quiz attempt history' })
  myQuizAttempts(@CurrentUser() user: JwtPayload, @Param('quizId') quizId: string) {
    return this.coursesService.getMyQuizAttempts(user.sub, quizId);
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  @Post('courses/:courseId/assignments')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Create an assignment for a course (creator only)' })
  createAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: Parameters<CoursesService['createAssignment']>[2],
  ) {
    return this.coursesService.createAssignment(user.sub, courseId, body);
  }

  @Get('courses/:courseId/assignments')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'List assignments for a course' })
  listAssignments(@Param('courseId') courseId: string) {
    return this.coursesService.listAssignments(courseId);
  }

  @Post('assignments/:assignmentId/submit')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Submit an assignment' })
  submitAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { content: string; fileUrls?: string[] },
  ) {
    return this.coursesService.submitAssignment(user.sub, assignmentId, body.content, body.fileUrls);
  }

  @Patch('courses/:courseId/assignments/:assignmentId/submissions/:submissionId/grade')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'Grade a student submission (creator only)' })
  gradeSubmission(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: { grade: number; feedback?: string },
  ) {
    return this.coursesService.gradeSubmission(user.sub, courseId, submissionId, body.grade, body.feedback);
  }

  @Get('courses/:courseId/assignments/:assignmentId/submissions')
  @RequireSkillFeature('skillEconomyLms')
  @ApiOperation({ summary: 'List submissions for an assignment (creator only)' })
  listSubmissions(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Param('assignmentId') assignmentId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.listSubmissions(user.sub, courseId, assignmentId, { page, limit });
  }
}
