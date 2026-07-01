import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MentorshipMatch,
  MentorshipMatchStatus,
  MentorshipProfile,
  MentorshipProfileStatus,
  MentorshipRole,
} from './entities/mentorship.entity';

@Injectable()
export class MentorshipService {
  constructor(
    @InjectRepository(MentorshipProfile)
    private readonly profileRepository: Repository<MentorshipProfile>,
    @InjectRepository(MentorshipMatch)
    private readonly matchRepository: Repository<MentorshipMatch>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Profile management ─────────────────────────────────────────────────────

  async upsertProfile(
    userId: string,
    communityId: string,
    input: {
      role: MentorshipRole;
      skills?: string[];
      goals?: string;
      maxMentees?: number;
      bio?: string;
    },
  ) {
    const existing = await this.profileRepository.findOne({ where: { userId, communityId } });
    if (existing) {
      if (input.skills !== undefined) existing.skills = input.skills.slice(0, 20);
      if (input.goals !== undefined) existing.goals = input.goals?.slice(0, 500) ?? null;
      if (input.maxMentees !== undefined) existing.maxMentees = Math.min(Math.max(input.maxMentees, 1), 10);
      if (input.bio !== undefined) existing.bio = input.bio?.slice(0, 1000) ?? null;
      existing.status = MentorshipProfileStatus.ACTIVE;
      return this.profileRepository.save(existing);
    }
    return this.profileRepository.save(
      this.profileRepository.create({
        userId,
        communityId,
        role: input.role,
        skills: (input.skills ?? []).slice(0, 20),
        goals: input.goals?.slice(0, 500) ?? null,
        maxMentees: Math.min(Math.max(input.maxMentees ?? 3, 1), 10),
        bio: input.bio?.slice(0, 1000) ?? null,
      }),
    );
  }

  async getProfile(userId: string, communityId: string) {
    return this.profileRepository.findOne({ where: { userId, communityId } });
  }

  async listMentors(communityId: string) {
    const mentors = await this.profileRepository.find({
      where: { communityId, role: MentorshipRole.MENTOR, status: MentorshipProfileStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    // Annotate with current mentee count
    const ids = mentors.map((m) => m.userId);
    if (ids.length === 0) return { data: [] };

    const counts = await this.dataSource.query<{ mentor_id: string; cnt: string }[]>(
      `SELECT mentor_id, COUNT(*) as cnt FROM mentorship_matches
       WHERE community_id = $1 AND mentor_id = ANY($2::uuid[]) AND status IN ('accepted','active')
       GROUP BY mentor_id`,
      [communityId, ids],
    );
    const countMap = Object.fromEntries(counts.map((r) => [r.mentor_id, parseInt(r.cnt, 10)]));

    return {
      data: mentors.map((m) => ({
        ...m,
        currentMentees: countMap[m.userId] ?? 0,
        hasCapacity: (countMap[m.userId] ?? 0) < m.maxMentees,
      })),
    };
  }

  // ── Matching algorithm ─────────────────────────────────────────────────────

  private scoreMatch(mentor: MentorshipProfile, mentee: MentorshipProfile): number {
    // Skill overlap: mentee.skills (goals encoded as skills) vs mentor.skills
    const menteeGoalKeywords = (mentee.goals ?? '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    const mentorSkills = mentor.skills.map((s) => s.toLowerCase());
    const overlap = mentorSkills.filter((s) =>
      menteeGoalKeywords.some((kw) => s.includes(kw) || kw.includes(s)),
    ).length;
    const skillScore = Math.min(overlap * 25, 60);

    // Skills in mentee.skills directly matching mentor.skills
    const directOverlap = mentee.skills.filter((s) =>
      mentorSkills.some((ms) => ms.includes(s.toLowerCase()) || s.toLowerCase().includes(ms)),
    ).length;
    const directScore = Math.min(directOverlap * 20, 40);

    return Math.min(skillScore + directScore, 100);
  }

  async runMatching(communityId: string): Promise<{
    matched: number;
    pairs: Array<{ mentorId: string; menteeId: string; score: number }>;
  }> {
    const [mentors, mentees] = await Promise.all([
      this.profileRepository.find({
        where: { communityId, role: MentorshipRole.MENTOR, status: MentorshipProfileStatus.ACTIVE },
      }),
      this.profileRepository.find({
        where: { communityId, role: MentorshipRole.MENTEE, status: MentorshipProfileStatus.ACTIVE },
      }),
    ]);

    if (!mentors.length || !mentees.length) return { matched: 0, pairs: [] };

    // Get current match counts for mentors
    const currentCounts = await this.dataSource.query<{ mentor_id: string; cnt: string }[]>(
      `SELECT mentor_id, COUNT(*) as cnt FROM mentorship_matches
       WHERE community_id = $1 AND status IN ('accepted','active')
       GROUP BY mentor_id`,
      [communityId],
    );
    const usedCapacity = Object.fromEntries(
      currentCounts.map((r) => [r.mentor_id, parseInt(r.cnt, 10)]),
    );

    // Get already-matched mentees
    const existingMatches = await this.matchRepository.find({
      where: [
        { communityId, status: MentorshipMatchStatus.PENDING },
        { communityId, status: MentorshipMatchStatus.ACCEPTED },
        { communityId, status: MentorshipMatchStatus.ACTIVE },
      ],
    });
    const matchedMenteeIds = new Set(existingMatches.map((m) => m.menteeId));

    const pairs: Array<{ mentorId: string; menteeId: string; score: number }> = [];
    const mentorCapacity = Object.fromEntries(
      mentors.map((m) => [m.userId, m.maxMentees - (usedCapacity[m.userId] ?? 0)]),
    );

    for (const mentee of mentees) {
      if (matchedMenteeIds.has(mentee.userId)) continue;

      // Score all available mentors
      const candidates = mentors
        .filter((m) => mentorCapacity[m.userId] > 0)
        .map((m) => ({ mentor: m, score: this.scoreMatch(m, mentee) }))
        .sort((a, b) => b.score - a.score);

      if (!candidates.length) continue;
      const best = candidates[0];

      try {
        await this.matchRepository.save(
          this.matchRepository.create({
            communityId,
            mentorId: best.mentor.userId,
            menteeId: mentee.userId,
            matchScore: best.score,
          }),
        );
        mentorCapacity[best.mentor.userId]--;
        pairs.push({ mentorId: best.mentor.userId, menteeId: mentee.userId, score: best.score });
      } catch {
        // Skip duplicate (unique constraint on mentor+mentee+community)
      }
    }

    return { matched: pairs.length, pairs };
  }

  // ── Match lifecycle ────────────────────────────────────────────────────────

  async respondToMatch(
    matchId: string,
    userId: string,
    accept: boolean,
  ): Promise<MentorshipMatch> {
    const match = await this.matchRepository.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.mentorId !== userId)
      throw new BadRequestException('Only the mentor can accept or decline');
    if (match.status !== MentorshipMatchStatus.PENDING)
      throw new BadRequestException('Match is no longer pending');

    match.status = accept ? MentorshipMatchStatus.ACCEPTED : MentorshipMatchStatus.DECLINED;
    return this.matchRepository.save(match);
  }

  async listMyMatches(userId: string, communityId: string) {
    const [asMentor, asMentee] = await Promise.all([
      this.matchRepository.find({ where: { mentorId: userId, communityId }, order: { createdAt: 'DESC' } }),
      this.matchRepository.find({ where: { menteeId: userId, communityId }, order: { createdAt: 'DESC' } }),
    ]);
    return { asMentor, asMentee };
  }

  async completeMatch(matchId: string, userId: string): Promise<void> {
    const match = await this.matchRepository.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.mentorId !== userId && match.menteeId !== userId) {
      throw new BadRequestException('Not a participant in this match');
    }
    await this.matchRepository.update(matchId, { status: MentorshipMatchStatus.COMPLETED });
  }
}
