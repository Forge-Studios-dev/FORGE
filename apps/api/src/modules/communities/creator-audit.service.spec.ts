import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreatorAuditService } from './creator-audit.service';
import { CreatorAuditLog } from './entities/community-room-message.entity';

describe('CreatorAuditService', () => {
  let service: CreatorAuditService;

  const auditRepository = {
    save: jest.fn(),
    create: jest.fn((x) => x),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    auditRepository.save.mockResolvedValue({ id: 'log-1' });
    auditRepository.find.mockResolvedValue([
      { id: 'log-1', action: 'room.permission.grant', createdAt: new Date() },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorAuditService,
        { provide: getRepositoryToken(CreatorAuditLog), useValue: auditRepository },
      ],
    }).compile();

    service = module.get(CreatorAuditService);
  });

  it('persists audit log entries', async () => {
    await service.log({
      creatorId: 'creator-1',
      actorId: 'creator-1',
      action: 'bundle.deactivate',
      resourceType: 'bundle',
      resourceId: 'b1',
    });
    expect(auditRepository.save).toHaveBeenCalled();
  });

  it('lists audit logs for creator', async () => {
    const result = await service.listForCreator('creator-1', 10);
    expect(result.data).toHaveLength(1);
  });
});
