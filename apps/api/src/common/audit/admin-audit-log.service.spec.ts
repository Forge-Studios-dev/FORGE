import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { User } from '../../modules/users/entities/user.entity';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;
  const repo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditLogService,
        { provide: getRepositoryToken(AdminAuditLog), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
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

  it('lists entries filtered by action/actor/target with pagination and actor profile', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [{ id: 'log-1', actorId: 'admin-1', action: 'strike.issue' }],
        1,
      ]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    userRepo.find.mockResolvedValue([
      { id: 'admin-1', username: 'ops', displayName: 'Ops Admin' },
    ]);

    const result = await service.list({
      page: 1,
      limit: 10,
      action: 'strike',
      actorId: 'admin-1',
      targetType: 'user',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('log.action ILIKE :action', { action: '%strike%' });
    expect(qb.andWhere).toHaveBeenCalledWith('log.actorId = :actorId', { actorId: 'admin-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('log.targetType = :targetType', { targetType: 'user' });
    expect(userRepo.find).toHaveBeenCalled();
    expect(result).toEqual({
      data: [
        {
          id: 'log-1',
          actorId: 'admin-1',
          action: 'strike.issue',
          actor: { id: 'admin-1', username: 'ops', displayName: 'Ops Admin' },
        },
      ],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
  });
});
