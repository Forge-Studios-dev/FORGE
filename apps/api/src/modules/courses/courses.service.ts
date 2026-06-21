import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Course, CourseCohort } from './entities/course.entity';
import {
  CourseEnrollment,
  CourseLesson,
  CourseLessonProgress,
} from './entities/course-lms.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TierEntitlementResourceType } from '../entitlements/entities/tier-entitlement.entity';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseCohort) private readonly cohortRepository: Repository<CourseCohort>,
    @InjectRepository(CourseLesson) private readonly lessonRepository: Repository<CourseLesson>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(CourseLessonProgress)
    private readonly progressRepository: Repository<CourseLessonProgress>,
    private readonly entitlementsService: EntitlementsService,
    private readonly accessSessionsService: AccessSessionsService,
  ) {}

  async listForCreator(creatorId: string) {
    return this.courseRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
    });
  }

  async createCourse(creatorId: string, input: { title: string; description?: string }) {
    const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await this.courseRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Course slug already exists');
    return this.courseRepository.save(
      this.courseRepository.create({
        creatorId,
        title: input.title.trim(),
        slug,
        description: input.description?.trim() || null,
      }),
    );
  }

  async updateCourse(
    creatorId: string,
    courseId: string,
    input: { title?: string; description?: string; isPublished?: boolean },
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    if (input.title !== undefined) course.title = input.title.trim();
    if (input.description !== undefined) course.description = input.description.trim() || null;
    if (input.isPublished !== undefined) course.isPublished = input.isPublished;
    return this.courseRepository.save(course);
  }

  async createCohort(creatorId: string, courseId: string, input: { name: string }) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.cohortRepository.save(
      this.cohortRepository.create({ courseId, name: input.name.trim() }),
    );
  }

  async listCohorts(creatorId: string, courseId: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.cohortRepository.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });
  }

  async reorderLessons(creatorId: string, courseId: string, lessonIds: string[]) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const lessons = await this.lessonRepository.find({ where: { courseId } });
    const idSet = new Set(lessonIds);
    if (idSet.size !== lessons.length || lessons.some((l) => !idSet.has(l.id))) {
      throw new BadRequestException('Invalid lesson order');
    }
    await Promise.all(
      lessonIds.map((id, index) =>
        this.lessonRepository.update({ id, courseId }, { sortOrder: index }),
      ),
    );
    return this.lessonRepository.find({
      where: { courseId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async listLessons(courseId: string, userId: string) {
    const course = await this.getCourseOrThrow(courseId);
    await this.assertCourseAccess(course, userId);
    return this.lessonRepository.find({
      where: { courseId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createLesson(
    creatorId: string,
    courseId: string,
    input: { title: string; content?: string; sortOrder?: number; durationMinutes?: number },
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await this.lessonRepository.findOne({ where: { courseId, slug } });
    if (existing) throw new BadRequestException('Lesson slug already exists');
    return this.lessonRepository.save(
      this.lessonRepository.create({
        courseId,
        title: input.title.trim(),
        slug,
        content: input.content?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        durationMinutes: input.durationMinutes ?? null,
      }),
    );
  }

  async enroll(userId: string, courseId: string, cohortId?: string) {
    const course = await this.getCourseOrThrow(courseId);
    await this.assertCourseAccess(course, userId);
    const existing = await this.enrollmentRepository.findOne({ where: { courseId, userId } });
    if (existing) return existing;
    return this.enrollmentRepository.save(
      this.enrollmentRepository.create({ courseId, userId, cohortId: cohortId ?? null }),
    );
  }

  async getProgress(userId: string, courseId: string) {
    const enrollment = await this.enrollmentRepository.findOne({ where: { courseId, userId } });
    if (!enrollment) throw new NotFoundException('Not enrolled');
    const lessons = await this.lessonRepository.count({ where: { courseId } });
    const completed = await this.progressRepository.count({
      where: { enrollmentId: enrollment.id, completedAt: Not(IsNull()) },
    });
    const rows = await this.progressRepository.find({ where: { enrollmentId: enrollment.id } });
    return {
      enrollmentId: enrollment.id,
      lessonsTotal: lessons,
      lessonsCompleted: completed,
      progress: lessons > 0 ? Math.round((completed / lessons) * 100) : 0,
      items: rows,
    };
  }

  async updateLessonProgress(
    userId: string,
    courseId: string,
    lessonId: string,
    progressPercent: number,
  ) {
    const enrollment = await this.enrollmentRepository.findOne({ where: { courseId, userId } });
    if (!enrollment) throw new ForbiddenException('Enroll first');
    const lesson = await this.lessonRepository.findOne({ where: { id: lessonId, courseId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    let row = await this.progressRepository.findOne({
      where: { enrollmentId: enrollment.id, lessonId },
    });
    if (!row) {
      row = this.progressRepository.create({ enrollmentId: enrollment.id, lessonId });
    }
    row.progressPercent = Math.min(100, Math.max(0, progressPercent));
    if (row.progressPercent >= 100) {
      row.completedAt = new Date();
    }
    return this.progressRepository.save(row);
  }

  private async getCourseOrThrow(courseId: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async assertCourseAccess(course: Course, userId: string) {
    if (course.creatorId === userId) return;
    if (!course.isPublished) throw new ForbiddenException('Course is not published');
    const entitled = await this.entitlementsService.hasTierEntitlement(
      userId,
      course.creatorId,
      TierEntitlementResourceType.COURSE,
      course.id,
    );
    if (!entitled) {
      const hasSub = await this.entitlementsService.hasActiveSubscription(userId, course.creatorId);
      if (!hasSub) throw new ForbiddenException('Course access required');
    }
    await this.accessSessionsService.requirePremiumSession(
      userId,
      course.creatorId,
      AccessSessionType.COURSE,
      course.id,
    );
  }
}
