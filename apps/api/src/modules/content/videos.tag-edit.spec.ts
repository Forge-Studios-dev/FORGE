import { BadRequestException } from '@nestjs/common';
import { VideosService } from './videos.service';
import { Video } from './entities/video.entity';

/**
 * Locks the contract for editing a published video's skill tags:
 * tags must exist and belong to the video's current category, and the
 * denormalized `tagsSearchText` (which feeds the generated FTS vector) is
 * recomputed so discovery stays consistent after a re-tag.
 */
describe('VideosService.applySkillTagUpdate', () => {
  const skillTagRepository = { find: jest.fn() };
  const categoryRepository = { findOne: jest.fn() };

  const svc = Object.create(VideosService.prototype) as VideosService;
  Object.assign(svc, { skillTagRepository, categoryRepository });

  // Private method — invoked via an explicitly-typed accessor.
  const applyTags = (video: Video, ids: string[]): Promise<void> =>
    (svc as unknown as { applySkillTagUpdate(v: Video, ids: string[]): Promise<void> }).applySkillTagUpdate(
      video,
      ids,
    );

  const makeVideo = (): Video => ({ categoryId: 'cat-1' }) as Video;

  beforeEach(() => jest.clearAllMocks());

  it('rejects an empty tag set', async () => {
    await expect(applyTags(makeVideo(), [])).rejects.toBeInstanceOf(BadRequestException);
    expect(skillTagRepository.find).not.toHaveBeenCalled();
  });

  it('rejects when one or more tag ids do not resolve', async () => {
    skillTagRepository.find.mockResolvedValue([
      { id: 't1', name: 'A', subcategory: { categoryId: 'cat-1' } },
    ]);
    await expect(applyTags(makeVideo(), ['t1', 't2'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a tag that belongs to a different category', async () => {
    skillTagRepository.find.mockResolvedValue([
      { id: 't1', name: 'A', subcategory: { categoryId: 'cat-1' } },
      { id: 't2', name: 'B', subcategory: { categoryId: 'cat-OTHER' } },
    ]);
    await expect(applyTags(makeVideo(), ['t1', 't2'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deduplicates ids before validating count', async () => {
    skillTagRepository.find.mockResolvedValue([
      { id: 't1', name: 'A', subcategory: { categoryId: 'cat-1' } },
    ]);
    categoryRepository.findOne.mockResolvedValue({ name: 'Coding' });
    const video = makeVideo();

    await applyTags(video, ['t1', 't1']);

    expect(skillTagRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: ['subcategory'] }),
    );
    expect(video.skillTags).toHaveLength(1);
  });

  it('applies tags and recomputes tagsSearchText with the category name', async () => {
    skillTagRepository.find.mockResolvedValue([
      { id: 't1', name: 'React', subcategory: { categoryId: 'cat-1' } },
      { id: 't2', name: 'Hooks', subcategory: { categoryId: 'cat-1' } },
    ]);
    categoryRepository.findOne.mockResolvedValue({ name: 'Coding' });
    const video = makeVideo();

    await applyTags(video, ['t1', 't2']);

    expect(video.skillTags.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(video.tagsSearchText).toBe('Coding React Hooks');
  });

  it('still recomputes tags when the category lookup returns null', async () => {
    skillTagRepository.find.mockResolvedValue([
      { id: 't1', name: 'React', subcategory: { categoryId: 'cat-1' } },
    ]);
    categoryRepository.findOne.mockResolvedValue(null);
    const video = makeVideo();

    await applyTags(video, ['t1']);

    expect(video.tagsSearchText).toBe('React');
  });
});
