import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommunityMemberBan,
  CommunityReport,
} from './entities/community-moderation.entity';
import { CommunityRole, CommunityRoleType } from './entities/community-role.entity';
import { Community } from './entities/community.entity';
import { ChannelMessage } from './entities/channel-message.entity';

@Injectable()
export class CommunityModerationService {
  constructor(
    @InjectRepository(CommunityReport)
    private readonly reportRepository: Repository<CommunityReport>,
    @InjectRepository(CommunityMemberBan)
    private readonly banRepository: Repository<CommunityMemberBan>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(ChannelMessage)
    private readonly messageRepository: Repository<ChannelMessage>,
  ) {}

  async reportMessage(
    reporterId: string,
    input: { communityId: string; channelId: string; messageId: string; reason: string },
  ) {
    const report = await this.reportRepository.save(
      this.reportRepository.create({
        communityId: input.communityId,
        channelId: input.channelId,
        messageId: input.messageId,
        reporterId,
        reason: input.reason.trim(),
        status: 'open',
      }),
    );
    return { id: report.id, status: report.status };
  }

  async listReports(status = 'open', limit = 50) {
    return this.reportRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async resolveReport(reportId: string, resolverId: string) {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = 'resolved';
    report.resolvedBy = resolverId;
    report.resolvedAt = new Date();
    await this.reportRepository.save(report);
    return { resolved: true };
  }

  async banMember(
    creatorId: string,
    communityId: string,
    userId: string,
    reason?: string,
    expiresAt?: Date | null,
  ) {
    const community = await this.getOwnedCommunity(creatorId, communityId);
    const existing = await this.banRepository.findOne({ where: { communityId: community.id, userId } });
    if (existing) {
      existing.reason = reason ?? null;
      existing.expiresAt = expiresAt ?? null;
      existing.createdBy = creatorId;
      await this.banRepository.save(existing);
    } else {
      await this.banRepository.save(
        this.banRepository.create({
          communityId: community.id,
          userId,
          reason: reason ?? null,
          expiresAt: expiresAt ?? null,
          createdBy: creatorId,
        }),
      );
    }
    return { banned: true };
  }

  async unbanMember(creatorId: string, communityId: string, userId: string) {
    await this.getOwnedCommunity(creatorId, communityId);
    await this.banRepository.delete({ communityId, userId });
    return { unbanned: true };
  }

  async assignRole(
    creatorId: string,
    communityId: string,
    userId: string,
    role: CommunityRoleType,
  ) {
    await this.getOwnedCommunity(creatorId, communityId);
    const existing = await this.roleRepository.findOne({ where: { communityId, userId } });
    if (existing) {
      existing.role = role;
      await this.roleRepository.save(existing);
    } else {
      await this.roleRepository.save(
        this.roleRepository.create({ communityId, userId, role }),
      );
    }
    return { assigned: true, role };
  }

  async listRoles(creatorId: string, communityId: string) {
    await this.getOwnedCommunity(creatorId, communityId);
    const roles = await this.roleRepository.find({
      where: { communityId },
      order: { createdAt: 'ASC' },
    });
    return roles.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      createdAt: r.createdAt,
    }));
  }

  async removeRole(creatorId: string, communityId: string, userId: string) {
    await this.getOwnedCommunity(creatorId, communityId);
    await this.roleRepository.delete({ communityId, userId });
    return { removed: true };
  }

  async listBans(creatorId: string, communityId: string) {
    await this.getOwnedCommunity(creatorId, communityId);
    const bans = await this.banRepository.find({
      where: { communityId },
      order: { createdAt: 'DESC' },
    });
    return bans.map((b) => ({
      id: b.id,
      userId: b.userId,
      reason: b.reason,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
    }));
  }

  async listReportsForCommunity(creatorId: string, communityId: string, status = 'open') {
    await this.getOwnedCommunity(creatorId, communityId);
    return this.reportRepository.find({
      where: { communityId, status },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async isBanned(communityId: string, userId: string): Promise<boolean> {
    const ban = await this.banRepository.findOne({ where: { communityId, userId } });
    if (!ban) return false;
    if (ban.expiresAt && ban.expiresAt <= new Date()) {
      await this.banRepository.delete({ id: ban.id });
      return false;
    }
    return true;
  }

  private async getOwnedCommunity(creatorId: string, communityId: string): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new BadRequestException('Community not found or not owned');
    }
    return community;
  }
}
