import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountPurgeService } from './account-purge.service';
import { User } from './entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { VideosService } from '../content/videos.service';

describe('AccountPurgeService', () => {
  let service: AccountPurgeService;

  const userRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const videoRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const videosService = {
    purgeVideoForDeletedAccount: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepository.find.mockResolvedValue([]);
    videoRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountPurgeService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: VideosService, useValue: videosService },
      ],
    }).compile();

    service = module.get(AccountPurgeService);
  });

  it('does nothing when no accounts are past the grace period', async () => {
    const result = await service.runDuePurges();
    expect(result).toEqual({ usersScanned: 0, videosPurged: 0 });
    expect(videosService.purgeVideoForDeletedAccount).not.toHaveBeenCalled();
  });

  it('hard-deletes every video owned by an account past the grace period', async () => {
    userRepository.find.mockResolvedValue([{ id: 'user-1' }]);
    videoRepository.find.mockResolvedValue([{ id: 'video-1' }, { id: 'video-2' }]);

    const result = await service.runDuePurges();

    expect(result).toEqual({ usersScanned: 1, videosPurged: 2 });
    expect(videosService.purgeVideoForDeletedAccount).toHaveBeenCalledTimes(2);
    expect(videosService.purgeVideoForDeletedAccount).toHaveBeenCalledWith({ id: 'video-1' });
    expect(videosService.purgeVideoForDeletedAccount).toHaveBeenCalledWith({ id: 'video-2' });
  });

  it('continues purging remaining videos when one fails', async () => {
    userRepository.find.mockResolvedValue([{ id: 'user-1' }]);
    videoRepository.find.mockResolvedValue([{ id: 'video-1' }, { id: 'video-2' }]);
    videosService.purgeVideoForDeletedAccount
      .mockRejectedValueOnce(new Error('s3 down'))
      .mockResolvedValueOnce(undefined);

    const result = await service.runDuePurges();

    expect(result.videosPurged).toBe(1);
    expect(videosService.purgeVideoForDeletedAccount).toHaveBeenCalledTimes(2);
  });

  it('scans multiple accounts and sums their purged video counts', async () => {
    userRepository.find.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
    videoRepository.find.mockResolvedValueOnce([{ id: 'video-1' }]).mockResolvedValueOnce([]);

    const result = await service.runDuePurges();

    expect(result).toEqual({ usersScanned: 2, videosPurged: 1 });
  });
});
