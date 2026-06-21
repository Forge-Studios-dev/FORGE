import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Community } from './entities/community.entity';
import {
  CommunityChallenge,
  CommunityChallengeParticipant,
  CommunitySurvey,
  CommunitySurveyResponse,
  CommunityWikiPage,
} from './entities/community-engagement.entity';
import { CommunitiesService } from './communities.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CommunityEngagementService {
  constructor(
    @InjectRepository(Community) private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityWikiPage)
    private readonly wikiRepository: Repository<CommunityWikiPage>,
    @InjectRepository(CommunityChallenge)
    private readonly challengeRepository: Repository<CommunityChallenge>,
    @InjectRepository(CommunityChallengeParticipant)
    private readonly challengeParticipantRepository: Repository<CommunityChallengeParticipant>,
    @InjectRepository(CommunitySurvey)
    private readonly surveyRepository: Repository<CommunitySurvey>,
    @InjectRepository(CommunitySurveyResponse)
    private readonly surveyResponseRepository: Repository<CommunitySurveyResponse>,
    private readonly communitiesService: CommunitiesService,
  ) {}

  private slugify(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 128);
  }

  private async assertCommunityOwner(creatorId: string, communityId: string) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    return community;
  }

  async listWiki(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const pages = await this.wikiRepository.find({
      where: { communityId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return { data: pages };
  }

  async createWiki(
    creatorId: string,
    communityId: string,
    input: { title: string; body?: string; sortOrder?: number },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const slug = this.slugify(input.title);
    const existing = await this.wikiRepository.findOne({ where: { communityId, slug } });
    if (existing) throw new BadRequestException('Wiki page slug already exists');
    const page = await this.wikiRepository.save(
      this.wikiRepository.create({
        communityId,
        slug,
        title: input.title.trim(),
        body: input.body?.trim() ?? '',
        authorId: creatorId,
        sortOrder: input.sortOrder ?? 0,
      }),
    );
    return { data: page };
  }

  async updateWiki(
    creatorId: string,
    communityId: string,
    wikiId: string,
    input: { title?: string; body?: string; sortOrder?: number },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const page = await this.wikiRepository.findOne({ where: { id: wikiId, communityId } });
    if (!page) throw new NotFoundException('Wiki page not found');
    if (input.title?.trim()) {
      page.title = input.title.trim();
      page.slug = this.slugify(input.title);
    }
    if (input.body !== undefined) page.body = input.body.trim();
    if (input.sortOrder !== undefined) page.sortOrder = input.sortOrder;
    const saved = await this.wikiRepository.save(page);
    return { data: saved };
  }

  async deleteWiki(creatorId: string, communityId: string, wikiId: string) {
    await this.assertCommunityOwner(creatorId, communityId);
    const page = await this.wikiRepository.findOne({ where: { id: wikiId, communityId } });
    if (!page) throw new NotFoundException('Wiki page not found');
    await this.wikiRepository.delete(wikiId);
    return { data: { id: wikiId, deleted: true } };
  }

  async listChallenges(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const challenges = await this.challengeRepository.find({
      where: { communityId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return { data: challenges };
  }

  async createChallenge(
    creatorId: string,
    communityId: string,
    input: { title: string; description?: string; startsAt?: string; endsAt?: string },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const challenge = await this.challengeRepository.save(
      this.challengeRepository.create({
        communityId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        isActive: true,
      }),
    );
    return { data: challenge };
  }

  async updateChallenge(
    creatorId: string,
    communityId: string,
    challengeId: string,
    input: {
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      isActive?: boolean;
    },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const challenge = await this.challengeRepository.findOne({
      where: { id: challengeId, communityId },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (input.title?.trim()) challenge.title = input.title.trim();
    if (input.description !== undefined) challenge.description = input.description?.trim() || null;
    if (input.startsAt !== undefined) challenge.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (input.endsAt !== undefined) challenge.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (input.isActive !== undefined) challenge.isActive = input.isActive;
    const saved = await this.challengeRepository.save(challenge);
    return { data: saved };
  }

  async deleteChallenge(creatorId: string, communityId: string, challengeId: string) {
    await this.assertCommunityOwner(creatorId, communityId);
    const challenge = await this.challengeRepository.findOne({
      where: { id: challengeId, communityId },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    challenge.isActive = false;
    await this.challengeRepository.save(challenge);
    return { data: { id: challengeId, isActive: false } };
  }

  async joinChallenge(
    userId: string,
    communityId: string,
    challengeId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, userId, viewerRole);
    const challenge = await this.challengeRepository.findOne({
      where: { id: challengeId, communityId, isActive: true },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    const existing = await this.challengeParticipantRepository.findOne({
      where: { challengeId, userId },
    });
    if (existing) return { data: existing };
    const row = await this.challengeParticipantRepository.save(
      this.challengeParticipantRepository.create({ challengeId, userId }),
    );
    return { data: row };
  }

  async updateChallengeProgress(
    userId: string,
    communityId: string,
    challengeId: string,
    progressPercent: number,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, userId, viewerRole);
    const participant = await this.challengeParticipantRepository.findOne({
      where: { challengeId, userId },
    });
    if (!participant) throw new NotFoundException('Not joined to this challenge');
    const clamped = Math.max(0, Math.min(100, progressPercent));
    participant.progressPercent = clamped;
    participant.completedAt = clamped >= 100 ? new Date() : null;
    const saved = await this.challengeParticipantRepository.save(participant);
    return { data: saved };
  }

  async listSurveys(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const surveys = await this.surveyRepository.find({
      where: { communityId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return { data: surveys };
  }

  async createSurvey(
    creatorId: string,
    communityId: string,
    input: {
      title: string;
      questions: Array<{ question: string; type?: string; options?: string[] }>;
      closesAt?: string;
    },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    if (!input.questions?.length) throw new BadRequestException('At least one question required');
    const survey = await this.surveyRepository.save(
      this.surveyRepository.create({
        communityId,
        title: input.title.trim(),
        questions: input.questions,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        isActive: true,
      }),
    );
    return { data: survey };
  }

  async updateSurvey(
    creatorId: string,
    communityId: string,
    surveyId: string,
    input: {
      title?: string;
      questions?: Array<{ question: string; type?: string; options?: string[] }>;
      closesAt?: string;
      isActive?: boolean;
    },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const survey = await this.surveyRepository.findOne({ where: { id: surveyId, communityId } });
    if (!survey) throw new NotFoundException('Survey not found');
    if (input.title?.trim()) survey.title = input.title.trim();
    if (input.questions) survey.questions = input.questions;
    if (input.closesAt !== undefined) survey.closesAt = input.closesAt ? new Date(input.closesAt) : null;
    if (input.isActive !== undefined) survey.isActive = input.isActive;
    const saved = await this.surveyRepository.save(survey);
    return { data: saved };
  }

  async deleteSurvey(creatorId: string, communityId: string, surveyId: string) {
    await this.assertCommunityOwner(creatorId, communityId);
    const survey = await this.surveyRepository.findOne({ where: { id: surveyId, communityId } });
    if (!survey) throw new NotFoundException('Survey not found');
    survey.isActive = false;
    await this.surveyRepository.save(survey);
    return { data: { id: surveyId, isActive: false } };
  }

  async getSurveyAnalytics(creatorId: string, communityId: string, surveyId: string) {
    await this.assertCommunityOwner(creatorId, communityId);
    const survey = await this.surveyRepository.findOne({ where: { id: surveyId, communityId } });
    if (!survey) throw new NotFoundException('Survey not found');
    const responseCount = await this.surveyResponseRepository.count({ where: { surveyId } });
    return {
      data: {
        surveyId,
        title: survey.title,
        responseCount,
        isActive: survey.isActive,
        closesAt: survey.closesAt,
      },
    };
  }

  async respondSurvey(
    userId: string,
    communityId: string,
    surveyId: string,
    answers: unknown[],
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, userId, viewerRole);
    const survey = await this.surveyRepository.findOne({
      where: { id: surveyId, communityId, isActive: true },
    });
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.closesAt && survey.closesAt < new Date()) {
      throw new BadRequestException('Survey is closed');
    }
    const existing = await this.surveyResponseRepository.findOne({
      where: { surveyId, userId },
    });
    if (existing) throw new BadRequestException('Already responded');
    const row = await this.surveyResponseRepository.save(
      this.surveyResponseRepository.create({ surveyId, userId, answers }),
    );
    return { data: row };
  }
}
