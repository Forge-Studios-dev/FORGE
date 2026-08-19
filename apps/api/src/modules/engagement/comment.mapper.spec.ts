import { toPublicComment } from './comment.mapper';
import { Comment, CommentModerationStatus } from './entities/comment.entity';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    userId: 'u1',
    user: { id: 'u1', username: 'alice', displayName: 'Alice' } as Comment['user'],
    videoId: 'v1',
    content: 'hello world',
    parentId: null,
    likeCount: 5,
    dislikeCount: 0,
    isPinned: false,
    creatorHearted: false,
    moderationStatus: CommentModerationStatus.NONE,
    moderatedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  } as Comment;
}

describe('toPublicComment', () => {
  it('maps a live comment with its real content, author, and counts', () => {
    const result = toPublicComment(makeComment());

    expect(result.isDeleted).toBe(false);
    expect(result.content).toBe('hello world');
    expect(result.userId).toBe('u1');
    expect(result.user).toMatchObject({ id: 'u1', username: 'alice', displayName: 'Alice' });
    expect(result.likeCount).toBe(5);
  });

  it('masks content and author for a soft-deleted comment kept for its replies', () => {
    const result = toPublicComment(
      makeComment({ deletedAt: new Date('2026-01-02'), content: 'the real deleted text', likeCount: 42 }),
      { replyCount: 3 },
    );

    expect(result.isDeleted).toBe(true);
    expect(result.content).toBe('[deleted]');
    expect(result.user).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.likeCount).toBe(0);
    expect(result.isPinned).toBe(false);
    expect(result.creatorHearted).toBe(false);
    // id/parentId/createdAt/replyCount survive so the reply thread stays anchored.
    expect(result.id).toBe('c1');
    expect(result.replyCount).toBe(3);
    expect(result.createdAt).toEqual(new Date('2026-01-01'));
  });

  it('never leaks moderationStatus for a deleted comment even when includeModerationStatus is requested', () => {
    const result = toPublicComment(
      makeComment({ deletedAt: new Date(), moderationStatus: CommentModerationStatus.HELD }),
      { includeModerationStatus: true },
    );

    expect(result.moderationStatus).toBeUndefined();
  });
});
