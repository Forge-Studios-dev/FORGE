import { describe, expect, it } from 'vitest';
import { splitCommentMentions } from './comment-text';

describe('splitCommentMentions', () => {
  it('splits @username mentions', () => {
    expect(splitCommentMentions('Hey @alice and @bob_1!')).toEqual([
      { type: 'text', value: 'Hey ' },
      { type: 'mention', value: '@alice', username: 'alice' },
      { type: 'text', value: ' and ' },
      { type: 'mention', value: '@bob_1', username: 'bob_1' },
      { type: 'text', value: '!' },
    ]);
  });

  it('ignores short or invalid handles', () => {
    expect(splitCommentMentions('email@x.com @a')).toEqual([
      { type: 'text', value: 'email@x.com @a' },
    ]);
  });

  it('returns plain text when no mentions', () => {
    expect(splitCommentMentions('Nice video')).toEqual([
      { type: 'text', value: 'Nice video' },
    ]);
  });
});
