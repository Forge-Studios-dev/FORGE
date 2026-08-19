import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoursesService } from './courses.service';
import { Course, CourseCohort } from './entities/course.entity';
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
} from './entities/course-quiz.entity';
import { Video, VideoStatus } from '../content/entities/video.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { EngagementService } from '../engagement/engagement.service';
import { Community } from '../communities/entities/community.entity';
import { User } from '../users/entities/user.entity';

describe('CoursesService', () => {
  let service: CoursesService;

  const course: Course = {
    id: 'course-1',
    creatorId: 'creator-1',
    title: 'Intro',
    slug: 'intro',
    description: null,
    isPublished: false,
    communityId: null,
    priceCents: 0,
    stripePriceId: null,
    isBundle: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const courseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (entity: Course) => ({ ...entity, id: entity.id ?? 'course-new' })),
    create: jest.fn((dto: Partial<Course>) => dto),
    createQueryBuilder: jest.fn(),
  };
  const cohortRepository = {
    save: jest.fn(async (entity: CourseCohort) => ({ ...entity, id: entity.id ?? 'cohort-1' })),
    create: jest.fn((dto: Partial<CourseCohort>) => dto),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const lessonRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(2),
    save: jest.fn(async (entity: CourseLesson) => ({ ...entity, id: entity.id ?? 'lesson-1' })),
    create: jest.fn((dto: Partial<CourseLesson>) => dto),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
  const enrollmentRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity: CourseEnrollment) => ({ ...entity, id: 'enroll-1' })),
    create: jest.fn((dto: Partial<CourseEnrollment>) => dto),
  };
  const progressRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn(async (entity: CourseLessonProgress) => entity),
    create: jest.fn((dto: Partial<CourseLessonProgress>) => dto),
  };
  const entitlementsService = {
    hasTierEntitlement: jest.fn().mockResolvedValue(true),
    hasActiveSubscription: jest.fn().mockResolvedValue(false),
  };
  const accessSessionsService = {
    requirePremiumSession: jest.fn().mockResolvedValue(undefined),
  };
  const eventEmitterMock = { emit: jest.fn() };
  const communityRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: Community) => ({ ...entity, id: entity.id ?? 'community-1', slug: entity.slug ?? 'test-slug' })),
    create: jest.fn((dto: Partial<Community>) => dto),
  };
  const mockVideo: Partial<Video> = {
    id: 'video-1',
    userId: 'creator-1',
    title: 'Intro Video',
    status: VideoStatus.READY,
    muxPlaybackId: 'playback-abc',
    hlsUrl: 'https://stream.mux.com/abc.m3u8',
    thumbnailUrl: null,
    durationSeconds: 300,
  };

  const videoRepository = {
    find: jest.fn().mockResolvedValue([mockVideo]),
    findOne: jest.fn().mockResolvedValue(mockVideo),
  };

  const userRepository = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'creator-1',
        username: 'creator',
        displayName: 'Creator',
      },
    ]),
  };

  const quizRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (e: Partial<CourseQuiz>) => ({ ...e, id: 'quiz-1' })),
    create: jest.fn((dto: Partial<CourseQuiz>) => dto),
  };
  const quizAttemptRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (e: Partial<CourseQuizAttempt>) => ({ ...e, id: 'attempt-1' })),
    create: jest.fn((dto: Partial<CourseQuizAttempt>) => dto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    courseRepository.findOne.mockImplementation(async ({ where }: { where: { id?: string; creatorId?: string } }) => {
      if (where.id === course.id) return course;
      if (where.creatorId === course.creatorId && where.id === course.id) return course;
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: courseRepository },
        { provide: getRepositoryToken(CourseCohort), useValue: cohortRepository },
        { provide: getRepositoryToken(CourseLesson), useValue: lessonRepository },
        { provide: getRepositoryToken(CourseEnrollment), useValue: enrollmentRepository },
        { provide: getRepositoryToken(CourseLessonProgress), useValue: progressRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        {
          provide: getRepositoryToken(CourseCertificate),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(async (e: CourseCertificate) => ({ ...e, id: 'cert-1', issuedAt: new Date() })),
            create: jest.fn((dto: Partial<CourseCertificate>) => dto),
          },
        },
        { provide: getRepositoryToken(CourseQuiz), useValue: quizRepository },
        { provide: getRepositoryToken(CourseQuizAttempt), useValue: quizAttemptRepository },
        {
          provide: getRepositoryToken(CourseAssignment),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(async (e: Partial<CourseAssignment>) => ({ ...e, id: 'asgn-1' })),
            create: jest.fn((dto: Partial<CourseAssignment>) => dto),
          },
        },
        {
          provide: getRepositoryToken(CourseAssignmentSubmission),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(async (e: Partial<CourseAssignmentSubmission>) => ({ ...e, id: 'sub-1' })),
            create: jest.fn((dto: Partial<CourseAssignmentSubmission>) => dto),
          },
        },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: AccessSessionsService, useValue: accessSessionsService },
        {
          provide: EngagementService,
          useValue: {
            isBlockedEitherWay: jest.fn().mockResolvedValue(false),
            getBlockedPeerIds: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get(CoursesService);
  });

  it('creates a course with slug', async () => {
    courseRepository.findOne.mockResolvedValueOnce(null);
    const created = await service.createCourse('creator-1', { title: 'My Course' });
    expect(created.slug).toBe('my-course');
    expect(courseRepository.save).toHaveBeenCalled();
  });

  it('enrolls a member when entitled', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    enrollmentRepository.findOne.mockResolvedValue(null);
    const enrollment = await service.enroll('user-1', 'course-1');
    expect(enrollment.courseId).toBe('course-1');
    expect(enrollmentRepository.save).toHaveBeenCalled();
  });

  it('denies lesson list without access', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    entitlementsService.hasTierEntitlement.mockResolvedValue(false);
    entitlementsService.hasActiveSubscription.mockResolvedValue(false);
    await expect(service.listLessons('course-1', 'user-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws when progress requested without enrollment', async () => {
    enrollmentRepository.findOne.mockResolvedValue(null);
    await expect(service.getProgress('user-1', 'course-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates course publish state', async () => {
    const updated = await service.updateCourse('creator-1', 'course-1', { isPublished: true });
    expect(updated.isPublished).toBe(true);
    expect(courseRepository.save).toHaveBeenCalled();
  });

  it('emits course.published only on the false->true transition', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: false });
    await service.updateCourse('creator-1', 'course-1', { isPublished: true });
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('course.published', {
      courseId: 'course-1',
      creatorId: 'creator-1',
    });
  });

  it('does not re-emit course.published when the course is already published', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    await service.updateCourse('creator-1', 'course-1', { title: 'Renamed' });
    expect(eventEmitterMock.emit).not.toHaveBeenCalledWith('course.published', expect.anything());
  });

  describe('updateLessonProgress', () => {
    beforeEach(() => {
      enrollmentRepository.findOne.mockResolvedValue({ id: 'enroll-1', courseId: 'course-1', userId: 'user-1' });
      lessonRepository.findOne.mockResolvedValue({ id: 'lesson-1', courseId: 'course-1' });
    });

    it('emits course.lesson.completed the first time progress reaches 100', async () => {
      progressRepository.findOne.mockResolvedValue(undefined);
      const result = await service.updateLessonProgress('user-1', 'course-1', 'lesson-1', 100);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('course.lesson.completed', {
        userId: 'user-1',
        courseId: 'course-1',
        lessonId: 'lesson-1',
      });
    });

    it('does not re-emit or reset completedAt on a repeat 100% update', async () => {
      const firstCompletedAt = new Date('2026-01-01T00:00:00Z');
      progressRepository.findOne.mockResolvedValue({
        enrollmentId: 'enroll-1',
        lessonId: 'lesson-1',
        progressPercent: 100,
        completedAt: firstCompletedAt,
      });
      const result = await service.updateLessonProgress('user-1', 'course-1', 'lesson-1', 100);
      expect(result.completedAt).toBe(firstCompletedAt);
      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith(
        'course.lesson.completed',
        expect.anything(),
      );
    });

    it('does not emit while progress is below 100', async () => {
      progressRepository.findOne.mockResolvedValue(undefined);
      const result = await service.updateLessonProgress('user-1', 'course-1', 'lesson-1', 50);
      expect(result.completedAt).toBeUndefined();
      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith(
        'course.lesson.completed',
        expect.anything(),
      );
    });
  });

  it('denies unpublished course to non-creator', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: false });
    entitlementsService.hasTierEntitlement.mockResolvedValue(true);
    await expect(service.listLessons('course-1', 'user-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lists cohorts for creator course', async () => {
    courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
    cohortRepository.find.mockResolvedValue([{ id: 'cohort-1', name: 'Spring' }]);
    const result = await service.listCohorts('creator-1', 'course-1');
    expect(result).toHaveLength(1);
  });

  it('creates a cohort persisting start/end window', async () => {
    courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
    const cohort = await service.createCohort('creator-1', 'course-1', {
      name: 'Spring 2026',
      startsAt: '2026-03-01T00:00:00.000Z',
      endsAt: '2026-05-01T00:00:00.000Z',
    });
    expect(cohort.startsAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
    expect(cohort.endsAt).toEqual(new Date('2026-05-01T00:00:00.000Z'));
    expect(cohortRepository.save).toHaveBeenCalled();
  });

  it('rejects a cohort whose end is not after its start', async () => {
    courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
    await expect(
      service.createCohort('creator-1', 'course-1', {
        name: 'Bad',
        startsAt: '2026-05-01T00:00:00.000Z',
        endsAt: '2026-03-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a cohort window', async () => {
    courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
    cohortRepository.findOne.mockResolvedValue({
      id: 'cohort-1',
      courseId: 'course-1',
      name: 'Spring',
      startsAt: null,
      endsAt: null,
    });
    const updated = await service.updateCohort('creator-1', 'course-1', 'cohort-1', {
      startsAt: '2026-03-01T00:00:00.000Z',
    });
    expect(updated.startsAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('rejects enrollment into a cohort from another course', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    enrollmentRepository.findOne.mockResolvedValue(null);
    cohortRepository.findOne.mockResolvedValue(null);
    await expect(service.enroll('user-1', 'course-1', 'foreign-cohort')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects enrollment into an ended cohort', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    enrollmentRepository.findOne.mockResolvedValue(null);
    cohortRepository.findOne.mockResolvedValue({
      id: 'cohort-1',
      courseId: 'course-1',
      endsAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await expect(service.enroll('user-1', 'course-1', 'cohort-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('enrolls into a valid open cohort', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    enrollmentRepository.findOne.mockResolvedValue(null);
    cohortRepository.findOne.mockResolvedValue({
      id: 'cohort-1',
      courseId: 'course-1',
      endsAt: new Date(Date.now() + 86_400_000),
    });
    const enrollment = await service.enroll('user-1', 'course-1', 'cohort-1');
    expect(enrollment.cohortId).toBe('cohort-1');
  });

  it('reorders lessons by id list', async () => {
    courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
    lessonRepository.find.mockResolvedValue([
      { id: 'l1', courseId: 'course-1' },
      { id: 'l2', courseId: 'course-1' },
    ]);
    lessonRepository.update.mockResolvedValue(undefined);
    lessonRepository.find.mockResolvedValueOnce([
      { id: 'l1', courseId: 'course-1' },
      { id: 'l2', courseId: 'course-1' },
    ]).mockResolvedValueOnce([
      { id: 'l2', courseId: 'course-1', sortOrder: 0 },
      { id: 'l1', courseId: 'course-1', sortOrder: 1 },
    ]);
    await service.reorderLessons('creator-1', 'course-1', ['l2', 'l1']);
    expect(lessonRepository.update).toHaveBeenCalled();
  });

  it('lists featured published courses for catalog', async () => {
    courseRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ ...course, isPublished: true }]),
    });
    lessonRepository.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ courseId: 'course-1', count: '2' }]),
    })) as never;
    const result = await service.listFeaturedCourses();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].lessonCount).toBe(2);
    expect(result.data[0].creator?.username).toBe('creator');
  });

  it('returns empty discover results for short queries', async () => {
    const result = await service.discoverCourses('a');
    expect(result.data).toEqual([]);
  });

  it('returns public course catalog metadata', async () => {
    courseRepository.findOne.mockResolvedValue({ ...course, isPublished: true });
    lessonRepository.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ courseId: 'course-1', count: '1' }]),
    })) as never;
    enrollmentRepository.find.mockResolvedValue([]);
    const result = await service.getPublicCourse('course-1', 'user-1');
    expect(result.data.title).toBe('Intro');
    expect(result.data.viewerEnrolled).toBe(false);
  });

  describe('video lessons', () => {
    it('creates a video lesson with videoId when creator owns video', async () => {
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      lessonRepository.findOne.mockResolvedValue(null);
      videoRepository.findOne.mockResolvedValue(mockVideo);
      const lesson = await service.createLesson('creator-1', 'course-1', {
        title: 'Intro Video Lesson',
        lessonType: LessonType.VIDEO,
        videoId: 'video-1',
      });
      expect(lesson.lessonType).toBe(LessonType.VIDEO);
      expect(lesson.videoId).toBe('video-1');
      expect(lesson.video?.muxPlaybackId).toBe('playback-abc');
      expect(lesson.video?.isReady).toBe(true);
    });

    it('throws when attaching video that does not belong to creator', async () => {
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      lessonRepository.findOne.mockResolvedValue(null);
      videoRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createLesson('creator-1', 'course-1', {
          title: 'Stolen Video',
          lessonType: LessonType.VIDEO,
          videoId: 'video-other',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates a lesson to attach a video', async () => {
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      lessonRepository.findOne.mockResolvedValue({
        id: 'lesson-1',
        courseId: 'course-1',
        title: 'Old',
        slug: 'old',
        content: null,
        sortOrder: 0,
        durationMinutes: null,
        lessonType: LessonType.TEXT,
        videoId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      videoRepository.findOne.mockResolvedValue(mockVideo);
      const result = await service.updateLesson('creator-1', 'course-1', 'lesson-1', {
        lessonType: LessonType.VIDEO,
        videoId: 'video-1',
      });
      expect(result.lessonType).toBe(LessonType.VIDEO);
      expect(result.video?.isReady).toBe(true);
    });

    it('updates a lesson to detach its video (null videoId)', async () => {
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      lessonRepository.findOne.mockResolvedValue({
        id: 'lesson-1',
        courseId: 'course-1',
        title: 'Lesson',
        slug: 'lesson',
        content: null,
        sortOrder: 0,
        durationMinutes: null,
        lessonType: LessonType.VIDEO,
        videoId: 'video-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      videoRepository.findOne.mockResolvedValue(null);
      const result = await service.updateLesson('creator-1', 'course-1', 'lesson-1', {
        videoId: null,
      });
      expect(result.videoId).toBeNull();
      expect(result.video).toBeNull();
    });

    it('deletes a lesson owned by creator', async () => {
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      lessonRepository.findOne.mockResolvedValue({
        id: 'lesson-1',
        courseId: 'course-1',
      });
      const result = await service.deleteLesson('creator-1', 'course-1', 'lesson-1');
      expect(result.success).toBe(true);
    });

    it('throws 404 when deleting lesson from wrong course', async () => {
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      lessonRepository.findOne.mockResolvedValue(null);
      await expect(
        service.deleteLesson('creator-1', 'course-1', 'missing-lesson'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('quizzes', () => {
    const quiz = {
      id: 'quiz-1',
      courseId: 'course-1',
      lessonId: null,
      title: 'Quiz 1',
      passingScore: 70,
      questions: [
        { prompt: 'Q1', options: ['a', 'b'], correctAnswer: 'a' },
        { prompt: 'Q2', options: ['a', 'b'], correctAnswer: 'b' },
      ],
      createdAt: new Date(),
    };

    it('strips correctAnswer from quiz questions for non-creators', async () => {
      quizRepository.find.mockResolvedValue([quiz]);
      courseRepository.findOne.mockResolvedValue(null);
      const [result] = await service.listQuizzes('student-1', 'course-1');
      expect(courseRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'course-1', creatorId: 'student-1' },
      });
      expect(result.questions[0]).not.toHaveProperty('correctAnswer');
      expect(result.questions[0]).toMatchObject({ prompt: 'Q1', options: ['a', 'b'] });
    });

    it('returns correctAnswer to the course creator', async () => {
      quizRepository.find.mockResolvedValue([quiz]);
      courseRepository.findOne.mockResolvedValue({ id: 'course-1', creatorId: 'creator-1' });
      const [result] = await service.listQuizzes('creator-1', 'course-1');
      expect(result.questions[0]).toHaveProperty('correctAnswer', 'a');
    });

    it('rejects quiz submission when the user is not enrolled', async () => {
      quizRepository.findOne.mockResolvedValue(quiz);
      enrollmentRepository.findOne.mockResolvedValue(null);
      await expect(
        service.submitQuiz('student-1', 'quiz-1', ['a', 'b']),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(quizAttemptRepository.save).not.toHaveBeenCalled();
    });

    it('grades a quiz submission for an enrolled user', async () => {
      quizRepository.findOne.mockResolvedValue(quiz);
      enrollmentRepository.findOne.mockResolvedValue({ id: 'enroll-1', courseId: 'course-1', userId: 'student-1' });
      const attempt = await service.submitQuiz('student-1', 'quiz-1', ['a', 'b']);
      expect(attempt.scorePercent).toBe(100);
      expect(attempt.passed).toBe(true);
    });
  });
});
