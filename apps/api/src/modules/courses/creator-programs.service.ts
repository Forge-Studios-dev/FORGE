import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Course, CourseBundleItem } from './entities/course.entity';
import { Community } from '../communities/entities/community.entity';
import { CoursesService } from './courses.service';

/**
 * "Programs" are bundle courses — Course rows with isBundle=true whose content
 * is other courses (via CourseBundleItem) instead of their own lessons. This
 * service used to operate on separate CreatorProgram/CreatorProgramCourse
 * tables; migration 1839800000000-merge-programs-into-courses folded that data
 * into courses/course_bundle_items. Method signatures and response shapes are
 * kept identical on purpose so the existing controller routes (and every web/
 * mobile consumer of them) don't need to change for this data-model merge.
 */
@Injectable()
export class CreatorProgramsService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseBundleItem)
    private readonly bundleItemRepository: Repository<CourseBundleItem>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    private readonly coursesService: CoursesService,
  ) {}

  private slugify(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 120);
  }

  private async getBundleOrThrow(creatorId: string | undefined, programId: string): Promise<Course> {
    const where = creatorId ? { id: programId, creatorId, isBundle: true } : { id: programId, isBundle: true };
    const bundle = await this.courseRepository.findOne({ where });
    if (!bundle) throw new NotFoundException('Program not found');
    return bundle;
  }

  private async mapProgram(program: Course, options?: { consumerView?: boolean }) {
    const itemRows = await this.bundleItemRepository.find({
      where: { bundleCourseId: program.id },
      order: { sortOrder: 'ASC' },
    });
    const courseIds = itemRows.map((r) => r.itemCourseId);
    const courses =
      courseIds.length === 0
        ? []
        : await this.courseRepository.find({ where: { id: In(courseIds) } });
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const consumerView = options?.consumerView ?? false;
    return {
      id: program.id,
      creatorId: program.creatorId,
      name: program.title,
      slug: program.slug,
      description: program.description,
      communityId: program.communityId,
      isPublished: program.isPublished,
      priceCents: program.priceCents,
      isFree: program.priceCents === 0,
      stripePriceId: program.stripePriceId,
      sortOrder: 0,
      courses: itemRows
        .map((row) => {
          const course = courseById.get(row.itemCourseId);
          if (consumerView && (!course || !course.isPublished)) return null;
          return {
            id: row.id,
            courseId: row.itemCourseId,
            sortOrder: row.sortOrder,
            course: course
              ? { id: course.id, title: course.title, slug: course.slug, isPublished: course.isPublished }
              : null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };
  }

  async listPublishedForCreator(creatorId: string, viewerId?: string | null) {
    const programs = await this.courseRepository.find({
      where: { creatorId, isBundle: true, isPublished: true },
      order: { createdAt: 'DESC' },
    });
    const consumerView = viewerId !== creatorId;
    const data = await Promise.all(
      programs.map((p) => this.mapProgram(p, { consumerView })),
    );
    return { data: data.filter((p) => p.courses.length > 0 || !consumerView) };
  }

  async getPublishedBySlug(creatorId: string, slug: string, viewerId?: string | null) {
    const program = await this.courseRepository.findOne({
      where: { creatorId, slug, isBundle: true, isPublished: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    return {
      data: await this.mapProgram(program, { consumerView: viewerId !== creatorId }),
    };
  }

  async enrollInProgram(userId: string, programId: string) {
    const program = await this.courseRepository.findOne({
      where: { id: programId, isBundle: true, isPublished: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (program.priceCents > 0) {
      throw new ForbiddenException(
        'This program requires purchase. Use the checkout endpoint to obtain access.',
      );
    }
    const mapped = await this.mapProgram(program, { consumerView: true });
    const courseIds = mapped.courses.map((c) => c.courseId);
    if (courseIds.length === 0) {
      throw new BadRequestException('Program has no published courses');
    }
    const enrollments = await Promise.all(
      courseIds.map((courseId) => this.coursesService.enroll(userId, courseId)),
    );
    return {
      data: {
        programId: program.id,
        enrollments: enrollments.map((e) => ({
          courseId: e.courseId,
          enrollmentId: e.id,
        })),
      },
    };
  }

  async listForCreator(creatorId: string) {
    const programs = await this.courseRepository.find({
      where: { creatorId, isBundle: true },
      order: { createdAt: 'DESC' },
    });
    const data = await Promise.all(programs.map((p) => this.mapProgram(p)));
    return { data };
  }

  async createProgram(
    creatorId: string,
    input: {
      name: string;
      description?: string;
      communityId?: string;
      isPublished?: boolean;
      courseIds?: string[];
    },
  ) {
    const slug = this.slugify(input.name);
    const existing = await this.courseRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Program slug already exists');

    if (input.communityId) {
      const community = await this.communityRepository.findOne({
        where: { id: input.communityId, creatorId },
      });
      if (!community) throw new BadRequestException('Community not found');
    }

    const program = await this.courseRepository.save(
      this.courseRepository.create({
        creatorId,
        title: input.name.trim(),
        slug,
        description: input.description?.trim() ?? null,
        communityId: input.communityId ?? null,
        isPublished: input.isPublished ?? false,
        isBundle: true,
      }),
    );

    if (input.courseIds?.length) {
      await this.setProgramCourses(creatorId, program.id, input.courseIds);
    }

    return { data: await this.mapProgram(program) };
  }

  async updateProgram(
    creatorId: string,
    programId: string,
    input: {
      name?: string;
      description?: string | null;
      communityId?: string | null;
      isPublished?: boolean;
      priceCents?: number;
      stripePriceId?: string | null;
      courseIds?: string[];
    },
  ) {
    const program = await this.getBundleOrThrow(creatorId, programId);

    if (input.name !== undefined) {
      program.title = input.name.trim();
      program.slug = this.slugify(input.name);
    }
    if (input.description !== undefined) program.description = input.description?.trim() ?? null;
    if (input.communityId !== undefined) {
      if (input.communityId) {
        const community = await this.communityRepository.findOne({
          where: { id: input.communityId, creatorId },
        });
        if (!community) throw new BadRequestException('Community not found');
      }
      program.communityId = input.communityId;
    }
    if (input.isPublished !== undefined) program.isPublished = input.isPublished;
    if (input.priceCents !== undefined) {
      if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
        throw new BadRequestException('priceCents must be a non-negative integer');
      }
      program.priceCents = input.priceCents;
    }
    if (input.stripePriceId !== undefined) program.stripePriceId = input.stripePriceId ?? null;

    await this.courseRepository.save(program);

    if (input.courseIds) {
      await this.setProgramCourses(creatorId, programId, input.courseIds);
    }

    return { data: await this.mapProgram(program) };
  }

  async deleteProgram(creatorId: string, programId: string) {
    await this.getBundleOrThrow(creatorId, programId);
    await this.bundleItemRepository.delete({ bundleCourseId: programId });
    await this.courseRepository.delete(programId);
    return { deleted: true, id: programId };
  }

  private async setProgramCourses(creatorId: string, programId: string, courseIds: string[]) {
    const uniqueIds = [...new Set(courseIds)];
    // isBundle: false — a bundle can only contain real courses, not other bundles.
    const owned = await this.courseRepository.find({
      where: uniqueIds.map((id) => ({ id, creatorId, isBundle: false })),
    });
    if (owned.length !== uniqueIds.length) {
      throw new BadRequestException('One or more courses not found');
    }
    await this.bundleItemRepository.delete({ bundleCourseId: programId });
    await this.bundleItemRepository.save(
      uniqueIds.map((courseId, index) =>
        this.bundleItemRepository.create({ bundleCourseId: programId, itemCourseId: courseId, sortOrder: index }),
      ),
    );
  }
}
