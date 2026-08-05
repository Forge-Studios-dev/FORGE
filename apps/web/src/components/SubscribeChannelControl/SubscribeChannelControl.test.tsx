import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubscribeChannelControl } from './SubscribeChannelControl';

const toggleSubscribe = vi.fn();
const getChannelSubscription = vi.fn();
const setChannelNotifyLevel = vi.fn();

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'me', emailVerified: true },
    isGuest: false,
  }),
}));

vi.mock('../../lib/engage-access', () => ({
  getEngageBlockReason: () => null,
}));

vi.mock('../../lib/engage-mutations', () => ({
  toggleSubscribe: (...args: unknown[]) => toggleSubscribe(...args),
  getChannelSubscription: (...args: unknown[]) => getChannelSubscription(...args),
  setChannelNotifyLevel: (...args: unknown[]) => setChannelNotifyLevel(...args),
  engageErrorReason: () => null,
}));

function renderControl(initialSubscribed = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SubscribeChannelControl channelId="channel-1" initialSubscribed={initialSubscribed} />
    </QueryClientProvider>,
  );
}

describe('SubscribeChannelControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toggleSubscribe.mockResolvedValue({ subscribed: true });
    getChannelSubscription.mockResolvedValue({ notifyLevel: 'all' });
    setChannelNotifyLevel.mockResolvedValue({ notifyLevel: 'all' });
  });

  it('subscribes when the Subscribe button is clicked', async () => {
    const user = userEvent.setup();
    renderControl(false);
    await user.click(screen.getByRole('button', { name: /^subscribe$/i }));
    await waitFor(() => {
      expect(toggleSubscribe).toHaveBeenCalledWith('channel-1', false);
    });
  });

  it('opens confirm dialog before unsubscribing from the menu', async () => {
    const user = userEvent.setup();
    renderControl(true);
    await user.click(screen.getByRole('button', { name: /subscription options/i }));
    await user.click(screen.getByRole('menuitem', { name: /^unsubscribe$/i }));
    expect(await screen.findByRole('heading', { name: /unsubscribe\?/i })).toBeInTheDocument();
    expect(toggleSubscribe).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^unsubscribe$/i }));
    await waitFor(() => {
      expect(toggleSubscribe).toHaveBeenCalledWith('channel-1', true);
    });
  });

  it('sets notify level from the menu', async () => {
    const user = userEvent.setup();
    renderControl(true);
    await user.click(screen.getByRole('button', { name: /subscription options/i }));
    await user.click(screen.getByRole('menuitemradio', { name: /^none$/i }));
    await waitFor(() => {
      expect(setChannelNotifyLevel).toHaveBeenCalledWith('channel-1', 'none');
    });
  });
});
