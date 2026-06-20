import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityPollsService } from './community-polls.service';
import { CommunityPoll } from './entities/community-poll.entity';
import { CommunityPollVote } from './entities/community-poll-vote.entity';
import { CommunitiesService } from './communities.service';

describe('CommunityPollsService', () => {
  let service: CommunityPollsService;
  let pollRepository: {
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
  };
  let voteRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let communitiesService: {
    assertOwnedCommunity: jest.Mock;
    assertCommunityAccess: jest.Mock;
  };

  beforeEach(async () => {
    pollRepository = {
      update: jest.fn().mockResolvedValue({}),
      save: jest.fn().mockImplementation(async (x) => {
        const saved = {
          id: 'poll-1',
          communityId: 'comm-1',
          isActive: true,
          createdAt: new Date(),
          ...x,
        };
        pollRepository.findOne.mockResolvedValue(saved);
        return saved;
      }),
      create: jest.fn((x) => x),
      findOne: jest.fn().mockResolvedValue({
        id: 'poll-1',
        communityId: 'comm-1',
        question: 'Favorite?',
        options: ['A', 'B'],
        isActive: true,
        createdAt: new Date(),
      }),
    };
    voteRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn((x) => x),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };
    communitiesService = {
      assertOwnedCommunity: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
      assertCommunityAccess: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityPollsService,
        { provide: getRepositoryToken(CommunityPoll), useValue: pollRepository },
        { provide: getRepositoryToken(CommunityPollVote), useValue: voteRepository },
        { provide: CommunitiesService, useValue: communitiesService },
      ],
    }).compile();

    service = module.get(CommunityPollsService);
  });

  it('creates a poll and deactivates previous active polls', async () => {
    const result = await service.createPoll('creator-1', 'comm-1', 'creator-1', {
      question: 'Pick one',
      options: ['Yes', 'No'],
    });

    expect(pollRepository.update).toHaveBeenCalled();
    expect(result.question).toBe('Pick one');
    expect(result.options).toEqual(['Yes', 'No']);
  });

  it('rejects polls with too few options', async () => {
    await expect(
      service.createPoll('creator-1', 'comm-1', 'creator-1', {
        question: 'Bad',
        options: ['Only'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a vote', async () => {
    const result = await service.votePoll('comm-1', 'poll-1', 'viewer-1', 1);

    expect(communitiesService.assertCommunityAccess).toHaveBeenCalled();
    expect(voteRepository.save).toHaveBeenCalled();
    expect(result.totalVotes).toBe(0);
  });

  it('rejects vote when communityId does not match poll', async () => {
    pollRepository.findOne.mockResolvedValue({
      id: 'poll-1',
      communityId: 'other-comm',
      options: ['A', 'B'],
      isActive: true,
    });

    await expect(service.votePoll('comm-1', 'poll-1', 'viewer-1', 0)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
