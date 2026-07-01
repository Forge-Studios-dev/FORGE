import 'reflect-metadata';
import { Permission } from '../../common/auth/permissions';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController security', () => {
  const reportsService = { create: jest.fn() };
  let controller: ReportsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReportsController(reportsService as unknown as ReportsService);
  });

  it('is mounted under reports', () => {
    expect(Reflect.getMetadata('path', ReportsController)).toBe('reports');
  });

  it('requires ENGAGE permission to submit reports', () => {
    const handler = (ReportsController.prototype as unknown as Record<string, unknown>)
      .create as object;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([Permission.ENGAGE]);
  });

  it('delegates create to service with reporter id', async () => {
    reportsService.create.mockResolvedValue({ id: 'report-1' });
    const dto = { targetType: 'video' as const, targetId: 'v1', reason: 'spam' };

    await controller.create({ sub: 'user-1', role: 'user' } as never, dto);

    expect(reportsService.create).toHaveBeenCalledWith('user-1', dto);
  });
});
