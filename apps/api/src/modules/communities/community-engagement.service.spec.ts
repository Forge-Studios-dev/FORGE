import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { CommunityEngagementService } from './community-engagement.service';
import { Community } from './entities/community.entity';
import {
  CommunityChallenge,
  CommunityChallengeParticipant,
  CommunitySurvey,
  CommunitySurveyResponse,
  CommunityWikiPage,
} from './entities/community-engagement.entity';
import { CommunitiesService } from './communities.service';

describe('CommunityEngagementService', () => {
  let service: CommunityEngagementService;

  const communityRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 'c1', creatorId: 'creator-1' }),
  };
  const wikiRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn((x) => ({ id: 'w1', ...x })),
    delete: jest.fn(),
  };
  const challengeRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'ch1', communityId: 'c1', isActive: true }),
    create: jest.fn((x) => x),
    save: jest.fn((x) => ({ id: 'ch1', ...x })),
  };
  const challengeParticipantRepository = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => ({ id: 'p1', ...x })),
  };
  const surveyRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => ({ id: 's1', ...x })),
  };
  const surveyResponseRepository = {
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x) => x),
    save: jest.fn((x) => ({ id: 'r1', ...x })),
  };
  const communitiesService = {
    assertCommunityAccess: jest.fn().mockResolvedValue({ id: 'c1', creatorId: 'creator-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    communitiesService.assertCommunityAccess.mockResolvedValue({ id: 'c1', creatorId: 'creator-1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityEngagementService,
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(CommunityWikiPage), useValue: wikiRepository },
        { provide: getRepositoryToken(CommunityChallenge), useValue: challengeRepository },
        { provide: getRepositoryToken(CommunityChallengeParticipant), useValue: challengeParticipantRepository },
        { provide: getRepositoryToken(CommunitySurvey), useValue: surveyRepository },
        { provide: getRepositoryToken(CommunitySurveyResponse), useValue: surveyResponseRepository },
        { provide: CommunitiesService, useValue: communitiesService },
      ],
    }).compile();

    service = module.get(CommunityEngagementService);
  });

  it('creates wiki page for community owner', async () => {
    wikiRepository.findOne.mockResolvedValue(null);
    const result = await service.createWiki('creator-1', 'c1', {
      title: 'Getting Started',
      body: 'Welcome',
    });
    expect(result.data.title).toBe('Getting Started');
  });

  it('joins challenge for member with access check', async () => {
    challengeParticipantRepository.findOne.mockResolvedValue(null);
    const result = await service.joinChallenge('user-1', 'c1', 'ch1');
    expect(result.data.challengeId).toBe('ch1');
    expect(communitiesService.assertCommunityAccess).toHaveBeenCalledWith('c1', 'user-1', undefined);
  });

  it('denies wiki list without community access', async () => {
    communitiesService.assertCommunityAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.listWiki('c1', 'user-1')).rejects.toThrow(ForbiddenException);
  });
});
