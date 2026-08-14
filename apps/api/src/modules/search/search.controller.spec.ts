import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  const searchService = {
    search: jest.fn(),
    suggestions: jest.fn(),
  };

  beforeEach(() => {
    searchService.search.mockResolvedValue({ videos: [], users: [], meta: { q: '' } });
    searchService.suggestions.mockResolvedValue({ titles: [] });
    controller = new SearchController(searchService as unknown as SearchService);
  });

  it('is mounted under search', () => {
    expect(Reflect.getMetadata('path', SearchController)).toBe('search');
  });

  it('marks search routes as public', () => {
    for (const name of ['search', 'suggestions'] as const) {
      const handler = (SearchController.prototype as unknown as Record<string, unknown>)[name] as object;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    }
  });

  it('delegates search to service with clamped limit and default filters', async () => {
    await controller.search('forge', 100);
    expect(searchService.search).toHaveBeenCalledWith(
      'forge',
      50,
      'all',
      {
        duration: 'any',
        uploaded: 'any',
        sort: 'relevance',
        captions: 'any',
        kind: 'any',
        watched: 'any',
      },
      undefined,
    );
  });

  it('passes type and watched filters plus viewer id', async () => {
    await controller.search(
      'forge',
      20,
      'channel',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'watched',
      { sub: 'user-1' } as never,
    );
    expect(searchService.search).toHaveBeenCalledWith(
      'forge',
      20,
      'channel',
      expect.objectContaining({ watched: 'watched' }),
      'user-1',
    );
  });

  it('delegates suggestions with default clamp bounds', async () => {
    await controller.suggestions('for', 5);
    expect(searchService.suggestions).toHaveBeenCalledWith('for', 5, undefined);
  });
});
