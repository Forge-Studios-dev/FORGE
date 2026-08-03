import { diversifyByCreator } from './feed-diversity.util';

describe('diversifyByCreator', () => {
  it('defers excess videos from the same creator', () => {
    const items = [
      { id: '1', userId: 'a' },
      { id: '2', userId: 'a' },
      { id: '3', userId: 'a' },
      { id: '4', userId: 'b' },
    ];
    expect(diversifyByCreator(items, 2).map((x) => x.id)).toEqual(['1', '2', '4', '3']);
  });

  it('returns input when short', () => {
    const items = [{ id: '1', userId: 'a' }];
    expect(diversifyByCreator(items, 2)).toEqual(items);
  });
});
