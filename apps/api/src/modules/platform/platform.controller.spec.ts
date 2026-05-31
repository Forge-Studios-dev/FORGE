import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlatformController } from './platform.controller';

describe('PlatformController', () => {
  let controller: PlatformController;

  beforeEach(async () => {
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, string | boolean> = {
          featureFlags: 'multipart_upload',
          'oauth.google.enabled': true,
          'firebase.projectId': 'proj',
          'firebase.clientEmail': 'sa@test.iam.gserviceaccount.com',
          'firebase.privateKey': 'key',
          'firebase.fcmEnabled': false,
          'firebase.appCheckEnabled': false,
        };
        return map[key];
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [{ provide: ConfigService, useValue: config }],
    }).compile();

    controller = moduleRef.get(PlatformController);
  });

  it('exposes auth and firebase capability flags', () => {
    const result = controller.getPublicConfig();

    expect(result.auth.provider).toBe('custom');
    expect(result.auth.googleOAuth).toBe(true);
    expect(result.auth.otpVerification).toBe(false);
    expect(result.firebase.usesFirebaseAuth).toBe(false);
    expect(result.firebase.adminConfigured).toBe(true);
  });
});
