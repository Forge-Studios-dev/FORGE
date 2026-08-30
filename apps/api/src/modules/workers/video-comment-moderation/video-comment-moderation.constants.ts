export const VIDEO_COMMENT_MODERATION_QUEUE = 'video-comment-moderation';

export type VideoCommentModerationJob = {
  commentId: string;
  /** Snapshot of body at enqueue time (comment may be edited later). */
  body: string;
};
