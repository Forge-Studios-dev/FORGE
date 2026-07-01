import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CommunityPoll } from './entities/community-poll.entity';
import { CommunityPollVote } from './entities/community-poll-vote.entity';
import { CommunitiesService } from './communities.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CommunityPollsService {
  constructor(
    @InjectRepository(CommunityPoll)
    private readonly pollRepository: Repository<CommunityPoll>,
    @InjectRepository(CommunityPollVote)
    private readonly voteRepository: Repository<CommunityPollVote>,
    @Inject(forwardRef(() => CommunitiesService))
    private readonly communitiesService: CommunitiesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPoll(
    creatorId: string,
    communityId: string,
    userId: string,
    input: { question: string; options: string[] },
  ) {
    await this.communitiesService.assertOwnedCommunity(creatorId, communityId);

    const options = input.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 6) {
      throw new BadRequestException('Polls need 2–6 options');
    }

    await this.pollRepository.update(
      { communityId, isActive: true },
      { isActive: false, closedAt: new Date() },
    );

    const poll = await this.pollRepository.save(
      this.pollRepository.create({
        communityId,
        question: input.question.trim(),
        options,
        isActive: true,
        createdByUserId: userId,
      }),
    );

    const publicPoll = await this.toPublicPoll(poll.id);
    this.eventEmitter.emit('community.poll.updated', {
      communityId,
      poll: publicPoll,
    });
    return publicPoll;
  }

  async getActivePoll(communityId: string, viewerId?: string | null, viewerRole?: UserRole | null) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const poll = await this.pollRepository.findOne({
      where: { communityId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    if (!poll) return null;
    return this.toPublicPoll(poll.id, viewerId ?? undefined);
  }

  async votePoll(
    communityId: string,
    pollId: string,
    userId: string,
    optionIndex: number,
    viewerRole?: UserRole | null,
  ) {
    const poll = await this.pollRepository.findOne({ where: { id: pollId, isActive: true } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.communityId !== communityId) {
      throw new NotFoundException('Poll not found in this community');
    }
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new BadRequestException('Invalid option');
    }

    await this.communitiesService.assertCommunityAccess(poll.communityId, userId, viewerRole);

    const existing = await this.voteRepository.findOne({ where: { pollId, userId } });
    if (existing) {
      existing.optionIndex = optionIndex;
      await this.voteRepository.save(existing);
    } else {
      await this.voteRepository.save(
        this.voteRepository.create({ pollId, userId, optionIndex }),
      );
    }

    const publicPoll = await this.toPublicPoll(pollId, userId);
    this.eventEmitter.emit('community.poll.updated', {
      communityId: poll.communityId,
      poll: publicPoll,
    });
    return publicPoll;
  }

  async closePoll(creatorId: string, communityId: string, pollId: string) {
    await this.communitiesService.assertOwnedCommunity(creatorId, communityId);
    const poll = await this.pollRepository.findOne({ where: { id: pollId, communityId } });
    if (!poll) throw new NotFoundException('Poll not found');
    await this.pollRepository.update({ id: pollId }, { isActive: false, closedAt: new Date() });
    const publicPoll = await this.toPublicPoll(pollId);
    this.eventEmitter.emit('community.poll.updated', {
      communityId,
      poll: publicPoll,
    });
    return { closed: true, poll: publicPoll };
  }

  private async toPublicPoll(pollId: string, viewerId?: string) {
    const poll = await this.pollRepository.findOne({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');

    let myOptionIndex: number | null = null;
    if (viewerId) {
      const myVote = await this.voteRepository.findOne({ where: { pollId, userId: viewerId } });
      myOptionIndex = myVote?.optionIndex ?? null;
    }

    const voteRows = await this.voteRepository
      .createQueryBuilder('v')
      .select('v.option_index', 'optionIndex')
      .addSelect('COUNT(*)', 'count')
      .where('v.poll_id = :pollId', { pollId })
      .groupBy('v.option_index')
      .getRawMany<{ optionIndex: number; count: string }>();

    const countByOption = new Map(
      voteRows.map((row) => [Number(row.optionIndex), parseInt(row.count, 10)]),
    );
    const counts = poll.options.map((_, i) => countByOption.get(i) ?? 0);
    const totalVotes = counts.reduce((a, b) => a + b, 0);

    return {
      id: poll.id,
      communityId: poll.communityId,
      question: poll.question,
      options: poll.options,
      counts,
      totalVotes,
      isActive: poll.isActive,
      createdAt: poll.createdAt,
      myOptionIndex,
    };
  }
}
