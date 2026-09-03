import { ConfigService } from '@nestjs/config';
import { FirebaseService } from './firebase.service';

describe('FirebaseService.verifyAppCheckToken', () => {
  function makeService(opts: {
    appCheckEnabled: boolean;
    appReady: boolean;
  }): FirebaseService {
    const config = {
      get: (key: string) => {
        if (key === 'firebase.appCheckEnabled') return opts.appCheckEnabled;
        return undefined;
      },
    } as unknown as ConfigService;
    const service = new FirebaseService(config);
    if (opts.appReady) {
      (service as unknown as { app: object }).app = { name: 'mock' };
    }
    return service;
  }

  it('accepts when App Check flag is off', async () => {
    const service = makeService({ appCheckEnabled: false, appReady: false });
    await expect(service.verifyAppCheckToken('anything')).resolves.toBe(true);
  });

  it('rejects when flag is on but Firebase Admin is missing (fail-closed)', async () => {
    const service = makeService({ appCheckEnabled: true, appReady: false });
    await expect(service.verifyAppCheckToken('attacker-token')).resolves.toBe(false);
  });
});
