import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreatorProgramsService } from './creator-programs.service';
import { Course, CourseBundleItem } from './entities/course.entity';
import { Community } from '../communities/entities/community.entity';
import { CoursesService } from './courses.service';
import { ProgramPurchase } from './entities/program-purchase.entity';
import { BillingService } from '../billing/billing.service';

describe('CreatorProgramsService', () => {
  let service: CreatorProgramsService;

  // A "program" is now a Course row with isBundle: true.
  const program: Course = {
    id: 'prog-1',
    creatorId: 'creator-1',
    title: 'Full Stack',
    slug: 'full-stack',
    description: 'Learn end to end',
    communityId: null,
    isPublished: true,
    priceCents: 0,
    stripePriceId: null,
    isBundle: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Course;

  const course: Course = {
    id: 'course-1',
    creatorId: 'creator-1',
    title: 'Intro',
    slug: 'intro',
    description: null,
    isPublished: true,
    communityId: null,
    priceCents: 0,
    stripePriceId: null,
    isBundle: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const bundleItem: CourseBundleItem = {
    id: 'pc-1',
    bundleCourseId: program.id,
    itemCourseId: course.id,
    sortOrder: 0,
    bundleCourse: program,
    itemCourse: course,
  };

  const bundleItemRepository = {
    find: jest.fn().mockResolvedValue([bundleItem]),
    save: jest.fn(),
    create: jest.fn((dto: Partial<CourseBundleItem>) => dto),
    delete: jest.fn(),
  };
  const courseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (entity: Course) => entity),
    create: jest.fn((dto: Partial<Course>) => dto),
    delete: jest.fn(),
  };
  const communityRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const purchaseRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (entity: ProgramPurchase) => ({ ...entity, id: 'purchase-1' })),
    create: jest.fn((dto: Partial<ProgramPurchase>) => dto),
  };
  const billingService = {
    createProgramCheckout: jest.fn().mockResolvedValue({
      ok: true,
      requiresCheckout: true,
      checkoutUrl: 'https://checkout.stripe.com/test',
      sessionId: 'cs_test',
    }),
  };

  const coursesService = {
    enroll: jest.fn().mockResolvedValue({ id: 'enroll-1', courseId: course.id, userId: 'user-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // courseRepository.find is used both to list bundle (program) rows and to
    // resolve bundle-item course ids — keyed on whether isBundle is requested.
    courseRepository.find.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.isBundle === true) return [program];
      return [course];
    });
    courseRepository.findOne.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id === program.id && where.isPublished === true && where.isBundle === true) return program;
      if (where.creatorId === program.creatorId && where.slug === program.slug && where.isBundle === true) {
        return program;
      }
      return null;
    });
    bundleItemRepository.find.mockResolvedValue([bundleItem]);
    purchaseRepository.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorProgramsService,
        { provide: getRepositoryToken(Course), useValue: courseRepository },
        { provide: getRepositoryToken(CourseBundleItem), useValue: bundleItemRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(ProgramPurchase), useValue: purchaseRepository },
        { provide: CoursesService, useValue: coursesService },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get(CreatorProgramsService);
  });

  it('lists published programs for consumers', async () => {
    const result = await service.listPublishedForCreator('creator-1', 'user-1');
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('full-stack');
    expect(result[0].courses[0].course?.title).toBe('Intro');
  });

  it('gets published program by slug', async () => {
    const result = await service.getPublishedBySlug('creator-1', 'full-stack', 'user-1');
    expect(result.id).toBe('prog-1');
  });

  it('throws when published program not found', async () => {
    courseRepository.findOne.mockResolvedValue(null);
    await expect(service.getPublishedBySlug('creator-1', 'missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('includes hasPurchased when viewer bought a paid program', async () => {
    const paidProgram = { ...program, priceCents: 2500 };
    courseRepository.findOne.mockResolvedValue(paidProgram);
    purchaseRepository.findOne.mockResolvedValue({ id: 'purchase-1', status: 'completed' });
    const result = await service.getPublishedBySlug('creator-1', 'full-stack', 'user-1');
    expect(result.hasPurchased).toBe(true);
  });

  it('enrolls user in all program courses', async () => {
    const result = await service.enrollInProgram('user-1', program.id);
    expect(coursesService.enroll).toHaveBeenCalledWith('user-1', course.id);
    expect(result.enrollments).toHaveLength(1);
  });

  it('rejects enroll when program has no published courses', async () => {
    bundleItemRepository.find.mockResolvedValue([]);
    await expect(service.enrollInProgram('user-1', program.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects free enroll on paid program without purchase', async () => {
    const paidProgram = { ...program, priceCents: 2500 };
    courseRepository.findOne.mockResolvedValue(paidProgram);
    await expect(service.enrollInProgram('user-1', program.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates checkout for paid program', async () => {
    const paidProgram = { ...program, priceCents: 2500 };
    courseRepository.findOne.mockResolvedValue(paidProgram);
    const result = await service.createProgramCheckout('user-1', program.id, {
      successUrl: 'https://forgestudios.net/success',
      cancelUrl: 'https://forgestudios.net/cancel',
    });
    expect(billingService.createProgramCheckout).toHaveBeenCalled();
    expect(result.checkoutUrl).toContain('checkout.stripe.com');
  });

  it('fulfills paid purchase and enrolls courses', async () => {
    await service.fulfillPaidPurchase({
      userId: 'user-1',
      programId: program.id,
      amountCents: 2500,
      currency: 'usd',
      stripeCheckoutSessionId: 'cs_1',
    });
    expect(purchaseRepository.save).toHaveBeenCalled();
    expect(coursesService.enroll).toHaveBeenCalledWith('user-1', course.id);
  });

  it('revokes paid purchase on refund webhook', async () => {
    purchaseRepository.findOne.mockResolvedValue({
      id: 'purchase-1',
      programId: program.id,
      userId: 'user-1',
      status: 'completed',
      stripePaymentIntentId: 'pi_1',
    });
    await service.revokePaidPurchaseByPaymentIntent('pi_1');
    expect(purchaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'refunded' }),
    );
  });

  it('restores refunded purchase to completed on re-fulfill', async () => {
    const paidProgram = { ...program, priceCents: 2500 };
    courseRepository.findOne.mockResolvedValue(paidProgram);
    purchaseRepository.findOne.mockResolvedValue({
      id: 'purchase-1',
      programId: program.id,
      userId: 'user-1',
      status: 'refunded',
      amountCents: 2500,
      currency: 'usd',
      stripeCheckoutSessionId: 'cs_old',
      stripePaymentIntentId: 'pi_old',
    });
    await service.fulfillPaidPurchase({
      userId: 'user-1',
      programId: program.id,
      amountCents: 2500,
      currency: 'usd',
      stripeCheckoutSessionId: 'cs_new',
      stripePaymentIntentId: 'pi_new',
    });
    expect(purchaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        stripeCheckoutSessionId: 'cs_new',
        stripePaymentIntentId: 'pi_new',
      }),
    );
    expect(coursesService.enroll).toHaveBeenCalledWith('user-1', course.id);
  });
});
