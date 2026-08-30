import { diversifyByCreator, applyExplorationBudget } from './feed-diversity.util';

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

describe('applyExplorationBudget', () => {
  it('weaves exploration ids into affinity slots after skipFirst', () => {
    const primary = [
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
      { id: 'a4' },
      { id: 'a5' },
      { id: 'a6' },
      { id: 'a7' },
      { id: 'a8' },
    ];
    const exploration = [{ id: 'e1' }, { id: 'e2' }];
    const out = applyExplorationBudget(primary, exploration, { ratio: 0.25, skipFirst: 3 });
    expect(out).toHaveLength(8);
    expect(out.slice(0, 3).map((x) => x.id)).toEqual(['a1', 'a2', 'a3']);
    expect(out.some((x) => x.id === 'e1')).toBe(true);
  });

  it('skips duplicates already in primary', () => {
    const primary = [
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
      { id: 'a4' },
      { id: 'a5' },
    ];
    const out = applyExplorationBudget(primary, [{ id: 'a2' }, { id: 'e1' }], {
      ratio: 0.2,
      skipFirst: 2,
    });
    expect(out.filter((x) => x.id === 'e1')).toHaveLength(1);
    expect(out.filter((x) => x.id === 'a2')).toHaveLength(1);
  });

  it('returns primary when exploration empty or list too short', () => {
    const primary = [{ id: 'a1' }, { id: 'a2' }];
    expect(applyExplorationBudget(primary, [{ id: 'e1' }])).toEqual(primary);
    expect(applyExplorationBudget([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }], [])).toEqual([
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
      { id: 'a4' },
    ]);
  });
});
