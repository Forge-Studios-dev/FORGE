import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, In, Not, Repository } from 'typeorm';
import { Course, CourseCohort } from './entities/course.entity';
import { Community, CommunityType } from '../communities/entities/community.entity';
import { User } from '../users/entities/user.entity';
import {
  CourseCertificate,
  CourseEnrollment,
  CourseLesson,
  CourseLessonProgress,
  LessonType,
} from './entities/course-lms.entity';
import {
  CourseQuiz,
  CourseQuizAttempt,
  CourseAssignment,
  CourseAssignmentSubmission,
  AssignmentSubmissionStatus,
} from './entities/course-quiz.entity';
import { Video, VideoStatus } from '../content/entities/video.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TierEntitlementResourceType } from '../entitlements/entities/tier-entitlement.entity';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';
import { clampLimit, clampPage, MAX_LIST_LIMIT } from '../../common/utils/pagination.util';

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
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(CourseCertificate)
    private readonly certificateRepository: Repository<CourseCertificate>,
    @InjectRepository(CourseQuiz) private readonly quizRepository: Repository<CourseQuiz>,
    @InjectRepository(CourseQuizAttempt)
    private readonly quizAttemptRepository: Repository<CourseQuizAttempt>,
    @InjectRepository(CourseAssignment)
    private readonly assignmentRepository: Repository<CourseAssignment>,
    @InjectRepository(CourseAssignmentSubmission)
    private readonly submissionRepository: Repository<CourseAssignmentSubmission>,
    private readonly entitlementsService: EntitlementsService,
    private readonly accessSessionsService: AccessSessionsService,
  ) {}

  // isBundle: false everywhere below — bundle-wrapper courses (formerly
  // CreatorProgram rows, see migration 1839800000000) surface only through
  // CreatorProgramsService's own endpoints, never in the plain course
  // catalog/search/discovery a learner or creator browses here.

  async listForCreator(creatorId: string, opts: { page?: unknown; limit?: unknown } = {}) {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    return this.courseRepository.find({
      where: { creatorId, isBundle: false },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  async listFeaturedCourses(limit = 12) {
    const take = clampLimit(limit, 12, 24);
    const courses = await this.courseRepository.find({
      where: { isPublished: true, isBundle: false },
      order: { createdAt: 'DESC' },
      take,
    });
    return { data: await this.mapPublicCourses(courses) };
  }

  async discoverCourses(query: string, limit = 20) {
    const term = query.trim();
    if (term.length < 2) return { data: [] };
    const pattern = `%${term}%`;
    const take = clampLimit(limit);
    const courses = await this.courseRepository
      .createQueryBuilder('c')
      .where('c.is_published = true')
      .andWhere('c.is_bundle = false')
      .andWhere(
        '(c.title ILIKE :pattern OR c.slug ILIKE :pattern OR COALESCE(c.description, \'\') ILIKE :pattern)',
        { pattern },
      )
      .orderBy('c.created_at', 'DESC')
      .take(take)
      .getMany();
    return { data: await this.mapPublicCourses(courses) };
  }

  async listPublishedForCreator(
    creatorId: string,
    viewerId?: string | null,
    opts: { page?: unknown; limit?: unknown } = {},
  ) {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const courses = await this.courseRepository.find({
      where: { creatorId, isPublished: true, isBundle: false },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data: await this.mapPublicCourses(courses, viewerId) };
  }

  async getPublicCourse(courseId: string, viewerId?: string | null) {
    const course = await this.courseRepository.findOne({
      where: { id: courseId, isPublished: true, isBundle: false },
    });
    if (!course) throw new NotFoundException('Course not found');
    const [mapped] = await this.mapPublicCourses([course], viewerId);
    return { data: mapped };
  }

  private async mapPublicCourses(courses: Course[], viewerId?: string | null) {
    if (courses.length === 0) return [];
    const courseIds = courses.map((c) => c.id);
    const creatorIds = [...new Set(courses.map((c) => c.creatorId))];

    const [creators, lessonCounts, enrollments] = await Promise.all([
      this.userRepository.find({ where: { id: In(creatorIds) } }),
      this.lessonRepository
        .createQueryBuilder('l')
        .select('l.course_id', 'courseId')
        .addSelect('COUNT(*)', 'count')
        .where('l.course_id IN (:...courseIds)', { courseIds })
        .groupBy('l.course_id')
        .getRawMany<{ courseId: string; count: string }>(),
      viewerId
        ? this.enrollmentRepository.find({
            where: { userId: viewerId, courseId: In(courseIds) },
          })
        : Promise.resolve([]),
    ]);

    const creatorById = new Map(creators.map((u) => [u.id, u]));
    const lessonCountByCourse = new Map(
      lessonCounts.map((row) => [row.courseId, Number(row.count)]),
    );
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

    return courses.map((course) => {
      const creator = creatorById.get(course.creatorId);
      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        creatorId: course.creatorId,
        lessonCount: lessonCountByCourse.get(course.id) ?? 0,
        createdAt: course.createdAt,
        creator: creator
          ? { id: creator.id, username: creator.username, displayName: creator.displayName }
          : null,
        viewerEnrolled: viewerId ? enrolledCourseIds.has(course.id) : false,
      };
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

  /** Validate/parse optional cohort window dates; enforce end-after-start. */
  private parseCohortDates(
    startsAt?: string | null,
    endsAt?: string | null,
  ): { start: Date | null; end: Date | null } {
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    if (start && Number.isNaN(start.getTime())) {
      throw new BadRequestException('startsAt is not a valid date');
    }
    if (end && Number.isNaN(end.getTime())) {
      throw new BadRequestException('endsAt is not a valid date');
    }
    if (start && end && end.getTime() <= start.getTime()) {
      throw new BadRequestException('Cohort endsAt must be after startsAt');
    }
    return { start, end };
  }

  async createCohort(
    creatorId: string,
    courseId: string,
    input: { name: string; startsAt?: string; endsAt?: string },
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const { start, end } = this.parseCohortDates(input.startsAt, input.endsAt);

    const cohort = await this.cohortRepository.save(
      this.cohortRepository.create({
        courseId,
        name: input.name.trim(),
        startsAt: start,
        endsAt: end,
        communityId: null,
      }),
    );

    // Auto-provision a COHORT-type community for this cohort. Platform-managed
    // so creators cannot directly set communityType = cohort.
    const communitySlug = `${course.slug}-cohort-${cohort.id.slice(0, 8)}`;
    const community = await this.communityRepository.save(
      this.communityRepository.create({
        creatorId,
        name: `${input.name.trim()} — ${course.title}`,
        slug: communitySlug,
        communityType: CommunityType.COHORT,
        linkedCourseId: courseId,
      }),
    );
    cohort.communityId = community.id;
    await this.cohortRepository.save(cohort);

    return { ...cohort, community: { id: community.id, slug: community.slug } };
  }

  async updateCohort(
    creatorId: string,
    courseId: string,
    cohortId: string,
    input: { name?: string; startsAt?: string; endsAt?: string },
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const cohort = await this.cohortRepository.findOne({ where: { id: cohortId, courseId } });
    if (!cohort) throw new NotFoundException('Cohort not found');

    // Validate the effective window (incoming values fall back to stored ones).
    const effectiveStart =
      input.startsAt !== undefined ? input.startsAt : cohort.startsAt?.toISOString() ?? null;
    const effectiveEnd =
      input.endsAt !== undefined ? input.endsAt : cohort.endsAt?.toISOString() ?? null;
    const { start, end } = this.parseCohortDates(effectiveStart, effectiveEnd);

    if (input.name !== undefined) cohort.name = input.name.trim();
    if (input.startsAt !== undefined) cohort.startsAt = start;
    if (input.endsAt !== undefined) cohort.endsAt = end;
    return this.cohortRepository.save(cohort);
  }

  async listCohorts(creatorId: string, courseId: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.cohortRepository.find({
      where: { courseId },
      order: { startsAt: 'ASC', createdAt: 'ASC' },
      take: MAX_LIST_LIMIT,
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
    const lessons = await this.lessonRepository.find({
      where: { courseId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return this.attachVideoMetadata(lessons);
  }

  /** Attach video playback metadata for any video-type lessons. */
  private async attachVideoMetadata(lessons: CourseLesson[]) {
    const videoIds = lessons
      .filter((l) => l.lessonType === LessonType.VIDEO && l.videoId)
      .map((l) => l.videoId as string);
    if (videoIds.length === 0) return lessons.map((l) => this.formatLesson(l, null));

    const videos = await this.videoRepository.find({ where: { id: In(videoIds) } });
    const videoMap = new Map(videos.map((v) => [v.id, v]));
    return lessons.map((l) => this.formatLesson(l, l.videoId ? (videoMap.get(l.videoId) ?? null) : null));
  }

  private formatLesson(lesson: CourseLesson, video: Video | null) {
    return {
      id: lesson.id,
      courseId: lesson.courseId,
      title: lesson.title,
      slug: lesson.slug,
      content: lesson.content,
      sortOrder: lesson.sortOrder,
      durationMinutes: lesson.durationMinutes,
      lessonType: lesson.lessonType,
      videoId: lesson.videoId,
      video: video
        ? {
            id: video.id,
            title: video.title,
            status: video.status,
            muxPlaybackId: video.muxPlaybackId,
            hlsUrl: video.hlsUrl,
            thumbnailUrl: video.thumbnailUrl,
            durationSeconds: video.durationSeconds,
            isReady: video.status === VideoStatus.READY,
          }
        : null,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  async createLesson(
    creatorId: string,
    courseId: string,
    input: {
      title: string;
      content?: string;
      sortOrder?: number;
      durationMinutes?: number;
      lessonType?: LessonType;
      videoId?: string;
    },
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const slug = input.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await this.lessonRepository.findOne({ where: { courseId, slug } });
    if (existing) throw new BadRequestException('Lesson slug already exists');

    const lessonType = input.lessonType ?? LessonType.TEXT;
    let resolvedVideoId: string | null = null;
    if (lessonType === LessonType.VIDEO && input.videoId) {
      resolvedVideoId = await this.assertCreatorVideo(creatorId, input.videoId);
    }

    const lesson = await this.lessonRepository.save(
      this.lessonRepository.create({
        courseId,
        title: input.title.trim(),
        slug,
        content: input.content?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        durationMinutes: input.durationMinutes ?? null,
        lessonType,
        videoId: resolvedVideoId,
      }),
    );
    const video = resolvedVideoId ? await this.videoRepository.findOne({ where: { id: resolvedVideoId } }) : null;
    return this.formatLesson(lesson, video);
  }

  async updateLesson(
    creatorId: string,
    courseId: string,
    lessonId: string,
    input: {
      title?: string;
      content?: string;
      sortOrder?: number;
      durationMinutes?: number;
      lessonType?: LessonType;
      videoId?: string | null;
    },
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const lesson = await this.lessonRepository.findOne({ where: { id: lessonId, courseId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    if (input.title !== undefined) {
      const newSlug = input.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const conflict = await this.lessonRepository.findOne({ where: { courseId, slug: newSlug } });
      if (conflict && conflict.id !== lessonId) throw new BadRequestException('Lesson slug conflict');
      lesson.title = input.title.trim();
      lesson.slug = newSlug;
    }
    if (input.content !== undefined) lesson.content = input.content.trim() || null;
    if (input.sortOrder !== undefined) lesson.sortOrder = input.sortOrder;
    if (input.durationMinutes !== undefined) lesson.durationMinutes = input.durationMinutes;
    if (input.lessonType !== undefined) lesson.lessonType = input.lessonType;

    if ('videoId' in input) {
      if (input.videoId === null) {
        lesson.videoId = null;
      } else if (input.videoId) {
        lesson.videoId = await this.assertCreatorVideo(creatorId, input.videoId);
      }
    }

    const saved = await this.lessonRepository.save(lesson);
    const video = saved.videoId ? await this.videoRepository.findOne({ where: { id: saved.videoId } }) : null;
    return this.formatLesson(saved, video);
  }

  async deleteLesson(creatorId: string, courseId: string, lessonId: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const lesson = await this.lessonRepository.findOne({ where: { id: lessonId, courseId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.lessonRepository.remove(lesson);
    return { success: true };
  }

  private async assertCreatorVideo(creatorId: string, videoId: string): Promise<string> {
    const video = await this.videoRepository.findOne({ where: { id: videoId, userId: creatorId } });
    if (!video) throw new NotFoundException('Video not found or does not belong to creator');
    return video.id;
  }

  async enroll(userId: string, courseId: string, cohortId?: string) {
    const course = await this.getCourseOrThrow(courseId);
    await this.assertCourseAccess(course, userId);

    let resolvedCohortId: string | null = null;
    if (cohortId) {
      // Data integrity: the cohort must belong to this course.
      const cohort = await this.cohortRepository.findOne({ where: { id: cohortId, courseId } });
      if (!cohort) throw new BadRequestException('Cohort does not belong to this course');
      // Window enforcement: cannot join a cohort that has already ended.
      if (cohort.endsAt && cohort.endsAt.getTime() < Date.now()) {
        throw new BadRequestException('This cohort has already ended');
      }
      resolvedCohortId = cohort.id;
    }

    const existing = await this.enrollmentRepository.findOne({ where: { courseId, userId } });
    if (existing) return existing;
    return this.enrollmentRepository.save(
      this.enrollmentRepository.create({ courseId, userId, cohortId: resolvedCohortId }),
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

  async bindCourseCommunity(
    creatorId: string,
    courseId: string,
    communityId?: string,
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');

    let community: Community | null = null;
    if (communityId) {
      community = await this.communityRepository.findOne({
        where: { id: communityId, creatorId },
      });
      if (!community) throw new NotFoundException('Community not found');
    } else {
      const slug = `${course.slug}-community`;
      community = await this.communityRepository.save(
        this.communityRepository.create({
          creatorId,
          name: `${course.title} Community`,
          slug,
          communityType: CommunityType.COURSE,
          linkedCourseId: courseId,
        }),
      );
    }

    course.communityId = community.id;
    community.linkedCourseId = courseId;
    community.communityType = CommunityType.COURSE;
    await this.courseRepository.save(course);
    await this.communityRepository.save(community);
    return { data: { courseId: course.id, communityId: community.id } };
  }

  /**
   * Issues a certificate when the learner has completed 100% of a course.
   * Idempotent — re-issuing returns the existing certificate.
   */
  async issueCertificate(userId: string, courseId: string): Promise<CourseCertificate> {
    const enrollment = await this.enrollmentRepository.findOne({ where: { courseId, userId } });
    if (!enrollment) throw new ForbiddenException('Not enrolled in this course');

    const totalLessons = await this.lessonRepository.count({ where: { courseId } });
    if (totalLessons === 0) throw new BadRequestException('Course has no lessons');

    const completedLessons = await this.progressRepository.count({
      where: { enrollmentId: enrollment.id, completedAt: Not(IsNull()) },
    });
    if (completedLessons < totalLessons) {
      throw new BadRequestException(
        `Course not complete: ${completedLessons}/${totalLessons} lessons done`,
      );
    }

    const existing = await this.certificateRepository.findOne({ where: { courseId, userId } });
    if (existing) return existing;

    const [course, user] = await Promise.all([
      this.courseRepository.findOne({ where: { id: courseId } }),
      this.userRepository.findOne({ where: { id: userId } }),
    ]);
    if (!course || !user) throw new NotFoundException('Course or user not found');

    const creator = await this.userRepository.findOne({ where: { id: course.creatorId } });

    return this.certificateRepository.save(
      this.certificateRepository.create({
        courseId,
        userId,
        recipientName: user.displayName ?? user.username,
        courseTitle: course.title,
        creatorName: creator?.displayName ?? creator?.username ?? 'Unknown Creator',
      }),
    );
  }

  /** Returns certificates earned by a user (paginated; capped at MAX_LIST_LIMIT per page). */
  async getMyCertificates(
    userId: string,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<CourseCertificate[]> {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    return this.certificateRepository.find({
      where: { userId },
      order: { issuedAt: 'DESC' },
      take,
      skip,
    });
  }

  /** Returns a single certificate by ID (public — validates ownership only for context). */
  async getCertificate(certificateId: string): Promise<CourseCertificate> {
    const cert = await this.certificateRepository.findOne({ where: { id: certificateId } });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  // ── Quiz methods (P03-T031) ─────────────────────────────────────────────────

  async createQuiz(
    creatorId: string,
    courseId: string,
    input: {
      title: string;
      lessonId?: string;
      questions: CourseQuiz['questions'];
      passingScore?: number;
    },
  ): Promise<CourseQuiz> {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.quizRepository.save(
      this.quizRepository.create({
        courseId,
        lessonId: input.lessonId ?? null,
        title: input.title,
        questions: input.questions,
        passingScore: Math.min(100, Math.max(0, input.passingScore ?? 70)),
      }),
    );
  }

  async listQuizzes(courseId: string): Promise<CourseQuiz[]> {
    return this.quizRepository.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
      take: MAX_LIST_LIMIT,
    });
  }

  async submitQuiz(
    userId: string,
    quizId: string,
    answers: Array<string | number>,
  ): Promise<CourseQuizAttempt> {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const correctCount = quiz.questions.reduce((acc, q, i) => {
      return answers[i] !== undefined && String(answers[i]) === String(q.correctAnswer) ? acc + 1 : acc;
    }, 0);

    const scorePercent = quiz.questions.length > 0
      ? Math.round((correctCount / quiz.questions.length) * 100)
      : 0;

    return this.quizAttemptRepository.save(
      this.quizAttemptRepository.create({
        quizId,
        userId,
        answers,
        scorePercent,
        passed: scorePercent >= quiz.passingScore,
      }),
    );
  }

  async getMyQuizAttempts(userId: string, quizId: string): Promise<CourseQuizAttempt[]> {
    return this.quizAttemptRepository.find({
      where: { quizId, userId },
      order: { attemptedAt: 'DESC' },
    });
  }

  // ── Assignment methods (P06-T031) ───────────────────────────────────────────

  async createAssignment(
    creatorId: string,
    courseId: string,
    input: {
      title: string;
      instructions: string;
      lessonId?: string;
      dueDays?: number;
      maxScore?: number;
    },
  ): Promise<CourseAssignment> {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.assignmentRepository.save(
      this.assignmentRepository.create({
        courseId,
        lessonId: input.lessonId ?? null,
        title: input.title,
        instructions: input.instructions,
        dueDays: input.dueDays ?? null,
        maxScore: input.maxScore ?? 100,
      }),
    );
  }

  async listAssignments(courseId: string): Promise<CourseAssignment[]> {
    return this.assignmentRepository.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
      take: MAX_LIST_LIMIT,
    });
  }

  async submitAssignment(
    userId: string,
    assignmentId: string,
    content: string,
    fileUrls?: string[],
  ): Promise<CourseAssignmentSubmission> {
    const assignment = await this.assignmentRepository.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const existing = await this.submissionRepository.findOne({ where: { assignmentId, userId } });
    if (existing) {
      existing.content = content;
      existing.fileUrls = fileUrls ?? [];
      existing.status = AssignmentSubmissionStatus.SUBMITTED;
      return this.submissionRepository.save(existing);
    }

    return this.submissionRepository.save(
      this.submissionRepository.create({
        assignmentId,
        userId,
        content,
        fileUrls: fileUrls ?? [],
        status: AssignmentSubmissionStatus.SUBMITTED,
      }),
    );
  }

  async gradeSubmission(
    creatorId: string,
    courseId: string,
    submissionId: string,
    grade: number,
    feedback?: string,
  ): Promise<CourseAssignmentSubmission> {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');

    const submission = await this.submissionRepository.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');

    const assignment = await this.assignmentRepository.findOne({
      where: { id: submission.assignmentId, courseId },
    });
    if (!assignment) throw new ForbiddenException();

    submission.grade = Math.min(assignment.maxScore, Math.max(0, grade));
    submission.feedback = feedback ?? null;
    submission.status = AssignmentSubmissionStatus.GRADED;
    return this.submissionRepository.save(submission);
  }

  async listSubmissions(
    creatorId: string,
    courseId: string,
    assignmentId: string,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<CourseAssignmentSubmission[]> {
    const course = await this.courseRepository.findOne({ where: { id: courseId, creatorId } });
    if (!course) throw new NotFoundException('Course not found');
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    return this.submissionRepository.find({
      where: { assignmentId },
      order: { submittedAt: 'DESC' },
      take,
      skip,
    });
  }
}
