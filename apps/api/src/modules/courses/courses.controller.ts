import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Courses')
@Controller('creators/me/courses')
@UseGuards(CreatorApprovedGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List creator courses' })
  list(@CurrentUser() user: JwtPayload) {
    return this.coursesService.listForCreator(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a course' })
  create(@CurrentUser() user: JwtPayload, @Body() body: { title: string; description?: string }) {
    return this.coursesService.createCourse(user.sub, body);
  }

  @Post(':courseId/cohorts')
  @ApiOperation({ summary: 'Create a course cohort' })
  createCohort(
    @CurrentUser() user: JwtPayload,
    @Param('courseId') courseId: string,
    @Body() body: { name: string },
  ) {
    return this.coursesService.createCohort(user.sub, courseId, body);
  }
}
