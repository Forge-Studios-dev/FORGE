import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;
  const repo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditLogService,
        { provide: getRepositoryToken(AdminAuditLog), useValue: repo },
      ],
    }).compile();
    service = module.get(AdminAuditLogService);
  });

  it('persists an entry with defaults for optional fields', async () => {
    repo.save.mockResolvedValue({ id: 'log-1' });
    await service.record({ actorId: 'admin-1', action: 'user.delete', targetType: 'user', targetId: 'u1' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'user.delete',
        targetType: 'user',
        targetId: 'u1',
        reason: null,
        metadata: null,
      }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('swallows a write failure instead of throwing (audit logging must not block the admin action)', async () => {
    repo.save.mockRejectedValue(new Error('db down'));
    await expect(
      service.record({ actorId: 'admin-1', action: 'user.delete' }),
    ).resolves.toBeUndefined();
  });

  it('lists entries filtered by action/actor/target with pagination', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'log-1' }], 1]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.list({ page: 1, limit: 10, action: 'strike.issue', actorId: 'admin-1' });

    expect(qb.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'strike.issue' });
    expect(qb.andWhere).toHaveBeenCalledWith('log.actorId = :actorId', { actorId: 'admin-1' });
    expect(result).toEqual({
      data: [{ id: 'log-1' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
  });
});
