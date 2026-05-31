export const PUSH_DISPATCH_QUEUE = 'push-dispatch';

export type PushDispatchJob = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};
