import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { Course, CourseCohort } from './entities/course.entity';
import {
  CourseEnrollment,
  CourseLesson,
  CourseLessonProgress,
} from './entities/course-lms.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';

describe('CoursesService', () => {
  let service: CoursesService;

  const course: Course = {
    id: 'course-1',
    creatorId: 'creator-1',
    title: 'Intro',
    slug: 'intro',
    description: null,
    isPublished: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const courseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (entity: Course) => ({ ...entity, id: entity.id ?? 'course-new' })),
    create: jest.fn((dto: Partial<Course>) => dto),
  };
  const cohortRepository = {
    save: jest.fn(async (entity: CourseCohort) => entity),
    create: jest.fn((dto: Partial<CourseCohort>) => dto),
    find: jest.fn().mockResolvedValue([]),
  };
  const lessonRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(2),
    save: jest.fn(async (entity: CourseLesson) => ({ ...entity, id: 'lesson-1' })),
    create: jest.fn((dto: Partial<CourseLesson>) => dto),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const enrollmentRepository = {
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
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: AccessSessionsService, useValue: accessSessionsService },
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
});
