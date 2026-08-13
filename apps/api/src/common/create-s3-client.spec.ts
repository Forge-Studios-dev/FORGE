import { EventEmitter } from 'node:events';

const mockS3Client = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
}));

const mockFromWebToken = jest.fn();
jest.mock('@aws-sdk/credential-providers', () => ({
  fromWebToken: (...args: unknown[]) => mockFromWebToken(...args),
}));

const mockHttpRequest = jest.fn();
jest.mock('node:http', () => ({
  request: (...args: unknown[]) => mockHttpRequest(...args),
}));

// Imported after the mocks above so the module under test picks them up.
import { createS3Client, createS3ClientForBrowserPresign } from './create-s3-client';

describe('createS3Client / createS3ClientForBrowserPresign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses static credentials when no roleArn is configured', () => {
    createS3Client({ region: 'us-east-1', accessKeyId: 'AKIA', secretAccessKey: 'secret' });

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret' },
      }),
    );
    expect(mockFromWebToken).not.toHaveBeenCalled();
  });

  it('createS3ClientForBrowserPresign also uses static credentials by default', () => {
    createS3ClientForBrowserPresign({ region: 'us-east-1', accessKeyId: 'AKIA', secretAccessKey: 'secret' });

    expect(mockS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret' },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      }),
    );
  });

  it('passes a credential provider function (not static keys) when roleArn is set', () => {
    createS3Client({
      region: 'us-east-1',
      accessKeyId: '',
      secretAccessKey: '',
      roleArn: 'arn:aws:iam::123456789012:role/forge-fly-media',
    });

    const config = mockS3Client.mock.calls[0][0];
    expect(typeof config.credentials).toBe('function');
    expect(mockFromWebToken).not.toHaveBeenCalled(); // only invoked lazily, on first credential resolution
  });

  it('the roleArn credential provider fetches a fresh Fly OIDC token and exchanges it via fromWebToken', async () => {
    // Simulate the Fly OIDC socket returning a JWT.
    mockHttpRequest.mockImplementation((_opts: unknown, callback: (res: unknown) => void) => {
      const res = new EventEmitter() as EventEmitter & { statusCode?: number };
      res.statusCode = 200;
      const req = new EventEmitter() as EventEmitter & { write: jest.Mock; end: jest.Mock };
      req.write = jest.fn();
      req.end = jest.fn(() => {
        callback(res);
        res.emit('data', Buffer.from('fly-oidc-jwt'));
        res.emit('end');
      });
      return req;
    });

    const assumedCredentials = { accessKeyId: 'ASIA...', secretAccessKey: 'x', sessionToken: 'y' };
    const assumeRoleProvider = jest.fn().mockResolvedValue(assumedCredentials);
    mockFromWebToken.mockReturnValue(assumeRoleProvider);

    createS3Client({
      region: 'us-east-1',
      accessKeyId: '',
      secretAccessKey: '',
      roleArn: 'arn:aws:iam::123456789012:role/forge-fly-media',
    });
    const credentialProvider = mockS3Client.mock.calls[0][0].credentials as () => Promise<unknown>;

    const result = await credentialProvider();

    expect(mockFromWebToken).toHaveBeenCalledWith(
      expect.objectContaining({
        roleArn: 'arn:aws:iam::123456789012:role/forge-fly-media',
        webIdentityToken: 'fly-oidc-jwt',
        durationSeconds: 900,
      }),
    );
    expect(result).toEqual(assumedCredentials);
  });

  it('rejects when the Fly OIDC socket returns a non-200 status', async () => {
    mockHttpRequest.mockImplementation((_opts: unknown, callback: (res: unknown) => void) => {
      const res = new EventEmitter() as EventEmitter & { statusCode?: number };
      res.statusCode = 500;
      const req = new EventEmitter() as EventEmitter & { write: jest.Mock; end: jest.Mock };
      req.write = jest.fn();
      req.end = jest.fn(() => {
        callback(res);
        res.emit('end');
      });
      return req;
    });

    createS3Client({
      region: 'us-east-1',
      accessKeyId: '',
      secretAccessKey: '',
      roleArn: 'arn:aws:iam::123456789012:role/forge-fly-media',
    });
    const credentialProvider = mockS3Client.mock.calls[0][0].credentials as () => Promise<unknown>;

    await expect(credentialProvider()).rejects.toThrow('Fly OIDC token request failed');
  });
});
