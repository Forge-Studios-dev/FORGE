import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Course, CourseBundleItem } from './entities/course.entity';
import { Community } from '../communities/entities/community.entity';
import { CoursesService } from './courses.service';
import { ProgramPurchase } from './entities/program-purchase.entity';
import { BillingService } from '../billing/billing.service';
import { slugify } from '../../common/utils/slugify.util';
import type { ProgramPurchaseCompletedEvent } from './program-purchase.listener';

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
    @InjectRepository(ProgramPurchase)
    private readonly purchaseRepository: Repository<ProgramPurchase>,
    private readonly coursesService: CoursesService,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
  ) {}

  private async getBundleOrThrow(creatorId: string | undefined, programId: string): Promise<Course> {
    const where = creatorId ? { id: programId, creatorId, isBundle: true } : { id: programId, isBundle: true };
    const bundle = await this.courseRepository.findOne({ where });
    if (!bundle) throw new NotFoundException('Program not found');
    return bundle;
  }

  private async mapProgram(
    program: Course,
    options?: { consumerView?: boolean; viewerId?: string | null },
  ) {
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
    let hasPurchased = false;
    if (options?.viewerId && program.priceCents > 0) {
      hasPurchased = !!(await this.purchaseRepository.findOne({
        where: { programId: program.id, userId: options.viewerId, status: 'completed' },
      }));
    }
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
      hasPurchased,
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
      programs.map((p) => this.mapProgram(p, { consumerView, viewerId })),
    );
    return { data: data.filter((p) => p.courses.length > 0 || !consumerView) };
  }

  async getPublishedBySlug(creatorId: string, slug: string, viewerId?: string | null) {
    const program = await this.courseRepository.findOne({
      where: { creatorId, slug, isBundle: true, isPublished: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    return {
      data: await this.mapProgram(program, {
        consumerView: viewerId !== creatorId,
        viewerId,
      }),
    };
  }

  async enrollInProgram(userId: string, programId: string) {
    const program = await this.courseRepository.findOne({
      where: { id: programId, isBundle: true, isPublished: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (program.priceCents > 0) {
      const purchased = await this.purchaseRepository.findOne({
        where: { programId, userId, status: 'completed' },
      });
      if (!purchased) {
        throw new ForbiddenException(
          'This program requires purchase. Use the checkout endpoint to obtain access.',
        );
      }
    }
    return this.enrollInProgramCourses(userId, program);
  }

  async createProgramCheckout(
    userId: string,
    programId: string,
    input: { successUrl: string; cancelUrl: string },
  ) {
    const program = await this.courseRepository.findOne({
      where: { id: programId, isBundle: true, isPublished: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (!program.priceCents || program.priceCents < 100) {
      throw new BadRequestException('This program is free — enroll directly');
    }

    const existing = await this.purchaseRepository.findOne({
      where: { programId, userId, status: 'completed' },
    });
    if (existing) {
      throw new BadRequestException('You already purchased this program');
    }

    return this.billingService.createProgramCheckout(userId, {
      programId: program.id,
      creatorId: program.creatorId,
      title: program.title,
      amountCents: program.priceCents,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
  }

  async fulfillPaidPurchase(input: ProgramPurchaseCompletedEvent) {
    const program = await this.courseRepository.findOne({
      where: { id: input.programId, isBundle: true, isPublished: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const existing = await this.purchaseRepository.findOne({
      where: { programId: input.programId, userId: input.userId },
    });
    if (!existing) {
      await this.purchaseRepository.save(
        this.purchaseRepository.create({
          programId: input.programId,
          userId: input.userId,
          amountCents: input.amountCents,
          currency: input.currency ?? 'usd',
          status: 'completed',
          purchasedAt: new Date(),
          stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
          stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        }),
      );
    }

    return this.enrollInProgramCourses(input.userId, program);
  }

  /** Revokes program ownership after Stripe reports refund/dispute (course enrollments are not rolled back). */
  async revokePaidPurchaseByPaymentIntent(paymentIntentId?: string): Promise<void> {
    if (!paymentIntentId) return;
    const purchase = await this.purchaseRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId, status: 'completed' },
    });
    if (!purchase) return;
    purchase.status = 'refunded';
    await this.purchaseRepository.save(purchase);
  }

  private async enrollInProgramCourses(userId: string, program: Course) {
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
      priceCents?: number;
    },
  ) {
    const slug = slugify(input.name, 120);
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
        priceCents:
          input.priceCents !== undefined && Number.isInteger(input.priceCents) && input.priceCents >= 0
            ? input.priceCents
            : 0,
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
      program.slug = slugify(input.name, 120);
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
