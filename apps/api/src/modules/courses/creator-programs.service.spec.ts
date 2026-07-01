import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreatorProgramsService } from './creator-programs.service';
import { CreatorProgram, CreatorProgramCourse } from './entities/creator-program.entity';
import { Course } from './entities/course.entity';
import { Community } from '../communities/entities/community.entity';
import { CoursesService } from './courses.service';

describe('CreatorProgramsService', () => {
  let service: CreatorProgramsService;

  const program = {
    id: 'prog-1',
    creatorId: 'creator-1',
    name: 'Full Stack',
    slug: 'full-stack',
    description: 'Learn end to end',
    communityId: null,
    community: null,
    isPublished: true,
    sortOrder: 0,
    courses: [],
    priceCents: 0,
    stripePriceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as CreatorProgram;

  const course: Course = {
    id: 'course-1',
    creatorId: 'creator-1',
    title: 'Intro',
    slug: 'intro',
    description: null,
    isPublished: true,
    communityId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const programCourse: CreatorProgramCourse = {
    id: 'pc-1',
    programId: program.id,
    courseId: course.id,
    sortOrder: 0,
    program,
  };

  const programRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (entity: CreatorProgram) => entity),
    create: jest.fn((dto: Partial<CreatorProgram>) => dto),
    delete: jest.fn(),
  };
  const programCourseRepository = {
    find: jest.fn().mockResolvedValue([programCourse]),
    save: jest.fn(),
    create: jest.fn((dto: Partial<CreatorProgramCourse>) => dto),
    delete: jest.fn(),
  };
  const courseRepository = {
    find: jest.fn().mockResolvedValue([course]),
    findOne: jest.fn(),
  };
  const communityRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const coursesService = {
    enroll: jest.fn().mockResolvedValue({ id: 'enroll-1', courseId: course.id, userId: 'user-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    programRepository.find.mockResolvedValue([program]);
    programRepository.findOne.mockImplementation(
      async ({ where }: { where: Partial<CreatorProgram> }) => {
        if (where.id === program.id && where.isPublished === true) return program;
        if (where.creatorId === program.creatorId && where.slug === program.slug) return program;
        return null;
      },
    );
    programCourseRepository.find.mockResolvedValue([programCourse]);
    courseRepository.find.mockResolvedValue([course]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorProgramsService,
        { provide: getRepositoryToken(CreatorProgram), useValue: programRepository },
        { provide: getRepositoryToken(CreatorProgramCourse), useValue: programCourseRepository },
        { provide: getRepositoryToken(Course), useValue: courseRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: CoursesService, useValue: coursesService },
      ],
    }).compile();

    service = module.get(CreatorProgramsService);
  });

  it('lists published programs for consumers', async () => {
    const result = await service.listPublishedForCreator('creator-1', 'user-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].slug).toBe('full-stack');
    expect(result.data[0].courses[0].course?.title).toBe('Intro');
  });

  it('gets published program by slug', async () => {
    const result = await service.getPublishedBySlug('creator-1', 'full-stack', 'user-1');
    expect(result.data.id).toBe('prog-1');
  });

  it('throws when published program not found', async () => {
    programRepository.findOne.mockResolvedValue(null);
    await expect(service.getPublishedBySlug('creator-1', 'missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('enrolls user in all program courses', async () => {
    const result = await service.enrollInProgram('user-1', program.id);
    expect(coursesService.enroll).toHaveBeenCalledWith('user-1', course.id);
    expect(result.data.enrollments).toHaveLength(1);
  });

  it('rejects enroll when program has no published courses', async () => {
    courseRepository.find.mockResolvedValue([]);
    await expect(service.enrollInProgram('user-1', program.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
