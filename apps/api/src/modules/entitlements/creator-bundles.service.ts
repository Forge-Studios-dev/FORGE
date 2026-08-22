import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CreatorBundle, CreatorBundleItem } from './entities/creator-bundle.entity';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { TierEntitlement, TierEntitlementResourceType } from './entities/tier-entitlement.entity';
import { slugify } from '../../common/utils/slugify.util';
import { CreateBundleDto, UpdateBundleDto } from './dto/bundle.dto';
import { EngagementService } from '../engagement/engagement.service';

@Injectable()
export class CreatorBundlesService {
  constructor(
    @InjectRepository(CreatorBundle)
    private readonly bundleRepository: Repository<CreatorBundle>,
    @InjectRepository(CreatorBundleItem)
    private readonly bundleItemRepository: Repository<CreatorBundleItem>,
    @InjectRepository(SubscriptionTier)
    private readonly tierRepository: Repository<SubscriptionTier>,
    @InjectRepository(TierEntitlement)
    private readonly tierEntitlementRepository: Repository<TierEntitlement>,
    private readonly eventEmitter: EventEmitter2,
    private readonly engagementService: EngagementService,
  ) {}

  private async assertTierOwned(creatorId: string, tierId: string) {
    const tier = await this.tierRepository.findOne({ where: { id: tierId } });
    if (!tier || tier.creatorId !== creatorId) {
      throw new BadRequestException('Tier not found or not owned by creator');
    }
    return tier;
  }

  private mapBundle(bundle: CreatorBundle) {
    return {
      id: bundle.id,
      creatorId: bundle.creatorId,
      tierId: bundle.tierId,
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description,
      isActive: bundle.isActive,
      sortOrder: bundle.sortOrder,
      items: (bundle.items ?? []).map((item) => ({
        id: item.id,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        sortOrder: item.sortOrder,
      })),
      tier: bundle.tier
        ? {
            id: bundle.tier.id,
            name: bundle.tier.name,
            priceCents: bundle.tier.priceCents,
            currency: bundle.tier.currency,
            billingInterval: bundle.tier.billingInterval,
          }
        : undefined,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    };
  }

  private itemKey(item: { resourceType: TierEntitlementResourceType; resourceId?: string | null }) {
    return `${item.resourceType}:${item.resourceId ?? ''}`;
  }

  private async isItemInAnyActiveBundle(
    tierId: string,
    item: { resourceType: TierEntitlementResourceType; resourceId?: string | null },
  ) {
    const bundles = await this.bundleRepository.find({
      where: { tierId, isActive: true },
      relations: ['items'],
    });
    const key = this.itemKey(item);
    return bundles.some((bundle) =>
      (bundle.items ?? []).some((bi) => this.itemKey(bi) === key),
    );
  }

  private async syncTierEntitlements(
    creatorId: string,
    tierId: string,
    items: Array<{ resourceType: TierEntitlementResourceType; resourceId?: string | null }>,
    removedItems: Array<{ resourceType: TierEntitlementResourceType; resourceId?: string | null }> = [],
  ) {
    await this.assertTierOwned(creatorId, tierId);
    const existing = await this.tierEntitlementRepository.find({ where: { tierId } });

    for (const item of items) {
      const resourceId = item.resourceId ?? null;
      const has = existing.some(
        (ent) => ent.resourceType === item.resourceType && ent.resourceId === resourceId,
      );
      if (!has) {
        await this.tierEntitlementRepository.save(
          this.tierEntitlementRepository.create({
            tierId,
            resourceType: item.resourceType,
            resourceId,
            accessLevel: 'full',
          }),
        );
      }
    }

    for (const item of removedItems) {
      const resourceId = item.resourceId ?? null;
      const stillReferenced = await this.isItemInAnyActiveBundle(tierId, item);
      if (!stillReferenced) {
        const ent = existing.find(
          (e) => e.resourceType === item.resourceType && e.resourceId === resourceId,
        );
        if (ent) await this.tierEntitlementRepository.delete(ent.id);
      }
    }
  }

  async listForCreator(creatorId: string) {
    const bundles = await this.bundleRepository.find({
      where: { creatorId },
      relations: ['items', 'tier'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    return { data: bundles.map((b) => this.mapBundle(b)) };
  }

  async listPublic(creatorId: string, viewerId?: string) {
    if (viewerId && (await this.engagementService.isBlockedEitherWay(viewerId, creatorId))) {
      throw new ForbiddenException('This channel is not available');
    }
    const bundles = await this.bundleRepository.find({
      where: { creatorId, isActive: true },
      relations: ['items', 'tier'],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    return {
      data: bundles
        .filter((b) => b.tier?.isActive)
        .map((b) => this.mapBundle(b)),
    };
  }

  async create(creatorId: string, input: CreateBundleDto) {
    await this.assertTierOwned(creatorId, input.tierId);
    const slug = slugify(input.name, 120);
    const existing = await this.bundleRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Bundle slug already exists');

    const bundle = await this.bundleRepository.save(
      this.bundleRepository.create({
        creatorId,
        tierId: input.tierId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        isActive: true,
      }),
    );

    await this.bundleItemRepository.save(
      input.items.map((item, index) =>
        this.bundleItemRepository.create({
          bundleId: bundle.id,
          resourceType: item.resourceType,
          resourceId: item.resourceId ?? null,
          sortOrder: index,
        }),
      ),
    );

    await this.syncTierEntitlements(creatorId, input.tierId, input.items);

    const refreshed = await this.bundleRepository.findOne({
      where: { id: bundle.id },
      relations: ['items', 'tier'],
    });
    if (!refreshed) throw new NotFoundException('Bundle not found');
    return { data: this.mapBundle(refreshed) };
  }

  async update(creatorId: string, bundleId: string, input: UpdateBundleDto) {
    const bundle = await this.bundleRepository.findOne({
      where: { id: bundleId },
      relations: ['items', 'tier'],
    });
    if (!bundle || bundle.creatorId !== creatorId) {
      throw new NotFoundException('Bundle not found');
    }

    const tierId = input.tierId ?? bundle.tierId;
    if (input.tierId) await this.assertTierOwned(creatorId, input.tierId);

    if (input.name && input.name.trim() !== bundle.name) {
      const slug = slugify(input.name, 120);
      const slugConflict = await this.bundleRepository.findOne({
        where: { creatorId, slug },
      });
      if (slugConflict && slugConflict.id !== bundleId) {
        throw new BadRequestException('Bundle slug already exists');
      }
      bundle.name = input.name.trim();
      bundle.slug = slug;
    }

    if (input.description !== undefined) bundle.description = input.description?.trim() || null;
    if (input.isActive !== undefined) bundle.isActive = input.isActive;
    if (input.sortOrder !== undefined) bundle.sortOrder = input.sortOrder;
    if (input.tierId) bundle.tierId = input.tierId;

    await this.bundleRepository.save(bundle);

    if (input.items) {
      const previousItems = (bundle.items ?? []).map((item) => ({
        resourceType: item.resourceType,
        resourceId: item.resourceId,
      }));
      const newItemKeys = new Set(input.items.map((item) => this.itemKey(item)));
      const removedItems = previousItems.filter((item) => !newItemKeys.has(this.itemKey(item)));

      await this.bundleItemRepository.delete({ bundleId });
      bundle.items = await this.bundleItemRepository.save(
        input.items.map((item, index) =>
          this.bundleItemRepository.create({
            bundleId,
            resourceType: item.resourceType,
            resourceId: item.resourceId ?? null,
            sortOrder: index,
          }),
        ),
      );
      await this.syncTierEntitlements(creatorId, tierId, input.items, removedItems);
    }

    const refreshed = await this.bundleRepository.findOne({
      where: { id: bundleId },
      relations: ['items', 'tier'],
    });
    if (!refreshed) throw new NotFoundException('Bundle not found');
    return { data: this.mapBundle(refreshed) };
  }

  async deactivate(creatorId: string, bundleId: string) {
    const bundle = await this.bundleRepository.findOne({ where: { id: bundleId } });
    if (!bundle || bundle.creatorId !== creatorId) {
      throw new NotFoundException('Bundle not found');
    }
    bundle.isActive = false;
    await this.bundleRepository.save(bundle);
    this.eventEmitter.emit('creator.audit.log', {
      creatorId,
      actorId: creatorId,
      action: 'bundle.deactivate',
      resourceType: 'bundle',
      resourceId: bundle.id,
    });
    return { data: { id: bundle.id, isActive: false } };
  }
}
