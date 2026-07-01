import 'reflect-metadata';
import { Permission } from '../../common/auth/permissions';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';

describe('DirectMessagesController security', () => {
  const service = {
    listConversations: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    markRead: jest.fn(),
  };

  let controller: DirectMessagesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DirectMessagesController(service as unknown as DirectMessagesService);
  });

  it('is mounted under messages', () => {
    expect(Reflect.getMetadata('path', DirectMessagesController)).toBe('messages');
  });

  it('requires ENGAGE permission on all routes', () => {
    for (const name of ['listConversations', 'getMessages', 'send', 'markRead'] as const) {
      const handler = (DirectMessagesController.prototype as unknown as Record<string, unknown>)[
        name
      ] as object;
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([Permission.ENGAGE]);
    }
  });

  it('delegates send to service with authenticated user id', async () => {
    service.sendMessage.mockResolvedValue({ id: 'msg-1' });
    await controller.send({ sub: 'user-a', role: 'user' } as never, {
      recipientId: 'user-b',
      content: 'Hello',
    });
    expect(service.sendMessage).toHaveBeenCalledWith('user-a', {
      recipientId: 'user-b',
      content: 'Hello',
    });
  });
});
