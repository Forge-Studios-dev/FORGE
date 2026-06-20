'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriptionTier } from '@/types';
import type { Community, CommunityCategory, CommunityChannel, CommunityPoll } from '@/types/community';
import { StudioModerationPanel } from '@/components/Community/StudioModerationPanel';
import { SubscriberPicker } from '@/components/Community/SubscriberPicker';
import { CommunityTrendsChart } from '@/components/Community/CommunityTrendsChart';

type Tab = 'channels' | 'categories' | 'engagement' | 'moderation' | 'settings';

export default function StudioCommunityDetailPage() {
  const params = useParams();
  const communityId = typeof params.id === 'string' ? params.id : '';
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('channels');
  const [statusMsg, setStatusMsg] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('public');
  const [channelTierId, setChannelTierId] = useState('');
  const [channelCategoryId, setChannelCategoryId] = useState('');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelType, setEditChannelType] = useState('public');
  const [editChannelTierId, setEditChannelTierId] = useState('');
  const [editChannelCategoryId, setEditChannelCategoryId] = useState('');
  const [invitingChannelId, setInvitingChannelId] = useState<string | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');

  const [communityName, setCommunityName] = useState('');
  const [communitySlug, setCommunitySlug] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [brandId, setBrandId] = useState('');

  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceMediaUrls, setAnnounceMediaUrls] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('Yes\nNo');

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(''), 3000);
  };

  const { data: payload } = useQuery({
    queryKey: ['studio-community-detail', communityId, user?.id],
    enabled: !!communityId && !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { community: Community; categories: CommunityCategory[]; channels: CommunityChannel[] };
      }>(`/communities/id/${communityId}`);
      return data.data;
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ['my-tiers', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionTier[] }>(`/creators/${user!.id}/tiers`);
      return data.data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['my-brands', user?.id],
    enabled: !!user?.id && isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: string; name: string }> }>(
        '/creators/me/brands',
      );
      return data.data;
    },
  });

  const { data: activePoll } = useQuery({
    queryKey: ['studio-community-poll', communityId],
    enabled: !!communityId && tab === 'engagement',
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityPoll | null }>(
        `/communities/${communityId}/polls/active`,
      );
      return data.data ?? null;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ['studio-community-analytics', communityId],
    enabled: !!communityId && tab === 'engagement',
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          messagesLast7Days: number;
          activeMembersLast7Days: number;
          postsLast7Days: number;
          pollVotesLast7Days: number;
          channelCount: number;
          retention?: { activeSubscribers: number; engagedMembers: number };
          trends?: {
            dailyMessages: Array<{ date: string; count: number }>;
            dailyPosts: Array<{ date: string; count: number }>;
          };
        };
      }>(`/creators/me/communities/${communityId}/analytics`);
      return data.data;
    },
  });

  const { data: studioPosts } = useQuery({
    queryKey: ['studio-community-posts', communityId],
    enabled: !!communityId && tab === 'engagement',
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          data: Array<{
            id: string;
            title?: string | null;
            body: string;
            postType: string;
            isPinned: boolean;
          }>;
        };
      }>(`/communities/${communityId}/posts`);
      return data.data.data;
    },
  });

  const community = payload?.community;

  useEffect(() => {
    if (!community) return;
    setCommunityName(community.name);
    setCommunitySlug(community.slug);
    setVisibility(community.visibility);
    setBrandId(community.brandId ?? '');
  }, [community]);

  const invalidateDetail = () => {
    void qc.invalidateQueries({ queryKey: ['studio-community-detail', communityId] });
  };

  const goLiveMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { id: string } }>('/streams/start', {
        title: `${community?.name ?? 'Community'} Live`,
        communityId,
        visibility: 'subscribers',
      });
      return data.data;
    },
    onSuccess: (stream) => {
      showStatus('Live stream created');
      window.location.href = `/studio/live?streamId=${stream.id}`;
    },
    onError: () => showStatus('Failed to start community live stream'),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/categories`, {
        name: categoryName.trim(),
      });
    },
    onSuccess: () => {
      setCategoryName('');
      invalidateDetail();
      showStatus('Category created');
    },
    onError: () => showStatus('Failed to create category'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, name }: { categoryId: string; name: string }) => {
      await api.patch(`/creators/me/communities/${communityId}/categories/${categoryId}`, { name });
    },
    onSuccess: () => {
      setEditingCategoryId(null);
      invalidateDetail();
      showStatus('Category updated');
    },
    onError: () => showStatus('Failed to update category'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/categories/${categoryId}`);
    },
    onSuccess: () => {
      invalidateDetail();
      showStatus('Category deleted');
    },
    onError: () => showStatus('Failed to delete category'),
  });

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/channels`, {
        name: channelName.trim(),
        type: channelType,
        requiredTierId: channelTierId || undefined,
        categoryId: channelCategoryId || undefined,
      });
    },
    onSuccess: () => {
      setChannelName('');
      invalidateDetail();
      showStatus('Channel created');
    },
    onError: () => showStatus('Failed to create channel'),
  });

  const updateChannelMutation = useMutation({
    mutationFn: async ({
      channelId,
      payload,
    }: {
      channelId: string;
      payload: {
        name?: string;
        type?: string;
        requiredTierId?: string | null;
        categoryId?: string | null;
      };
    }) => {
      await api.patch(`/creators/me/channels/${channelId}`, payload);
    },
    onSuccess: () => {
      setEditingChannelId(null);
      invalidateDetail();
      showStatus('Channel updated');
    },
    onError: () => showStatus('Failed to update channel'),
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
      await api.post(`/creators/me/channels/${channelId}/invite`, { userId });
    },
    onSuccess: () => {
      setInviteUserId('');
      setInvitingChannelId(null);
      showStatus('Invite sent');
    },
    onError: () => showStatus('Failed to send invite'),
  });

  const updateCommunityMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/creators/me/communities/${communityId}`, {
        name: communityName.trim(),
        slug: communitySlug.trim() || undefined,
        visibility,
        brandId: brandId || null,
      });
    },
    onSuccess: () => {
      invalidateDetail();
      showStatus('Settings saved');
    },
    onError: () => showStatus('Failed to save settings'),
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/posts`, {
        title: announceTitle.trim() || undefined,
        body: announceBody.trim(),
        postType: 'announcement',
        isPinned: true,
        mediaUrls: announceMediaUrls
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      setAnnounceTitle('');
      setAnnounceBody('');
      setAnnounceMediaUrls('');
      showStatus('Announcement published');
    },
    onError: () => showStatus('Failed to publish announcement'),
  });

  const createPollMutation = useMutation({
    mutationFn: async () => {
      const options = pollOptions
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);
      await api.post(`/creators/me/communities/${communityId}/polls`, {
        question: pollQuestion.trim(),
        options,
      });
    },
    onSuccess: () => {
      setPollQuestion('');
      setPollOptions('Yes\nNo');
      void qc.invalidateQueries({ queryKey: ['studio-community-poll', communityId] });
      showStatus('Poll launched');
    },
    onError: () => showStatus('Failed to create poll'),
  });

  const closePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      await api.post(`/creators/me/communities/${communityId}/polls/${pollId}/close`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-community-poll', communityId] });
      showStatus('Poll closed');
    },
  });

  const pinPostMutation = useMutation({
    mutationFn: async ({ postId, isPinned }: { postId: string; isPinned: boolean }) => {
      await api.post(`/creators/me/communities/${communityId}/posts/${postId}/pin`, { isPinned });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-community-posts', communityId] });
      showStatus('Post updated');
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/posts/${postId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['studio-community-posts', communityId] });
      showStatus('Post deleted');
    },
  });

  if (!isCreator) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Creator access required.</p>
      </main>
    );
  }

  const channelTypeSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
    >
      <option value="public">Public</option>
      <option value="subscribers">Members only</option>
      <option value="tier">Tier gated</option>
      <option value="invite">Invite only</option>
    </select>
  );

  const tierSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
    >
      <option value="">Tier (optional)</option>
      {(tiers ?? []).map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );

  const categorySelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
    >
      <option value="">No category</option>
      {(payload?.categories ?? []).map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 md:px-12">
      <PageHeader
        title={community?.name ?? 'Community'}
        subtitle={community ? `/${community.slug}` : 'Manage community'}
      />

      {statusMsg ? (
        <p className="mb-4 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary">{statusMsg}</p>
      ) : null}

      <nav className="mb-6 flex flex-wrap gap-2">
        {(['channels', 'categories', 'engagement', 'moderation', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${
              tab === t
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'channels' ? (
        <div className="space-y-6">
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">New channel</h2>
            <Input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Channel name"
            />
            {channelTypeSelect(channelType, setChannelType)}
            {tierSelect(channelTierId, setChannelTierId)}
            {categorySelect(channelCategoryId, setChannelCategoryId)}
            <Button
              disabled={!channelName.trim() || createChannelMutation.isPending}
              onClick={() => createChannelMutation.mutate()}
            >
              Create channel
            </Button>
          </section>
          <ul className="space-y-2">
            {(payload?.channels ?? []).map((ch) => (
              <li key={ch.id} className="glass-panel rounded-xl p-4">
                {editingChannelId === ch.id ? (
                  <div className="space-y-2">
                    <Input value={editChannelName} onChange={(e) => setEditChannelName(e.target.value)} />
                    {channelTypeSelect(editChannelType, setEditChannelType)}
                    {tierSelect(editChannelTierId, setEditChannelTierId)}
                    {categorySelect(editChannelCategoryId, setEditChannelCategoryId)}
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          updateChannelMutation.mutate({
                            channelId: ch.id,
                            payload: {
                              name: editChannelName,
                              type: editChannelType,
                              requiredTierId: editChannelTierId || null,
                              categoryId: editChannelCategoryId || null,
                            },
                          })
                        }
                        disabled={updateChannelMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingChannelId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{ch.name}</p>
                      <p className="text-xs capitalize text-on-surface-variant">
                        {ch.type} · #{ch.slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() => {
                          setEditingChannelId(ch.id);
                          setEditChannelName(ch.name);
                          setEditChannelType(ch.type);
                          setEditChannelTierId(ch.requiredTierId ?? '');
                          setEditChannelCategoryId(ch.categoryId ?? '');
                        }}
                      >
                        Edit
                      </Button>
                      {ch.type === 'invite' ? (
                        <Button
                          variant="outline"
                          className="text-xs"
                          onClick={() =>
                            setInvitingChannelId(invitingChannelId === ch.id ? null : ch.id)
                          }
                        >
                          Invite
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
                {invitingChannelId === ch.id ? (
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!inviteUserId.trim()) return;
                      inviteMutation.mutate({ channelId: ch.id, userId: inviteUserId.trim() });
                    }}
                  >
                    <SubscriberPicker
                      value={inviteUserId}
                      onChange={setInviteUserId}
                      placeholder="Search subscribers to invite"
                    />
                    <Button type="submit" disabled={inviteMutation.isPending || !inviteUserId} className="text-xs">
                      Send invite
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'categories' ? (
        <div className="space-y-6">
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">New category</h2>
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Category name"
            />
            <Button
              disabled={!categoryName.trim() || createCategoryMutation.isPending}
              onClick={() => createCategoryMutation.mutate()}
            >
              Create category
            </Button>
          </section>
          <ul className="space-y-2">
            {(payload?.categories ?? []).map((cat) => (
              <li key={cat.id} className="glass-panel rounded-xl p-4">
                {editingCategoryId === cat.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() =>
                        updateCategoryMutation.mutate({ categoryId: cat.id, name: editCategoryName })
                      }
                      disabled={updateCategoryMutation.isPending}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingCategoryId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-xs text-on-surface-variant">#{cat.slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setEditCategoryName(cat.name);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-error"
                        onClick={() => {
                          if (window.confirm('Delete this category?')) {
                            deleteCategoryMutation.mutate(cat.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'engagement' ? (
        <div className="space-y-6">
          {analytics ? (
            <section className="glass-panel grid gap-3 rounded-xl p-6 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs text-on-surface-variant">Messages (7d)</p>
                <p className="text-2xl font-semibold">{analytics.messagesLast7Days}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Active members (7d)</p>
                <p className="text-2xl font-semibold">{analytics.activeMembersLast7Days}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Posts (7d)</p>
                <p className="text-2xl font-semibold">{analytics.postsLast7Days}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Poll votes (7d)</p>
                <p className="text-2xl font-semibold">{analytics.pollVotesLast7Days}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Channels</p>
                <p className="text-2xl font-semibold">{analytics.channelCount}</p>
              </div>
              {analytics.retention ? (
                <>
                  <div>
                    <p className="text-xs text-on-surface-variant">Active subscribers</p>
                    <p className="text-2xl font-semibold">{analytics.retention.activeSubscribers}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Engaged members (XP)</p>
                    <p className="text-2xl font-semibold">{analytics.retention.engagedMembers}</p>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}
          {analytics?.trends ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <CommunityTrendsChart
                title="Messages per day (7d)"
                data={analytics.trends.dailyMessages}
              />
              <CommunityTrendsChart
                title="Posts per day (7d)"
                data={analytics.trends.dailyPosts}
                colorClass="bg-tertiary"
              />
            </div>
          ) : null}
          <section className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
            <div>
              <h2 className="font-label-caps text-outline">Community live</h2>
              <p className="text-xs text-on-surface-variant">
                Start a live stream linked to this community&apos;s Live Discussion channel.
              </p>
            </div>
            <Button
              onClick={() => goLiveMutation.mutate()}
              disabled={goLiveMutation.isPending}
            >
              Go live in community
            </Button>
          </section>
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">Posts</h2>
            {(studioPosts ?? []).length === 0 ? (
              <p className="text-xs text-on-surface-variant">No posts yet.</p>
            ) : (
              <ul className="space-y-2">
                {(studioPosts ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/30 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      {p.isPinned ? (
                        <span className="text-xs font-medium text-primary">Pinned · </span>
                      ) : null}
                      <span className="text-sm font-medium">{p.title || p.postType}</span>
                      <p className="truncate text-xs text-on-surface-variant">{p.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        className="text-xs"
                        onClick={() =>
                          pinPostMutation.mutate({ postId: p.id, isPinned: !p.isPinned })
                        }
                      >
                        {p.isPinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs text-error"
                        onClick={() => {
                          if (window.confirm('Delete this post?')) deletePostMutation.mutate(p.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">Announcement</h2>
            <p className="text-xs text-on-surface-variant">
              Pinned post; notifies all active subscribers asynchronously.
            </p>
            <Input
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="Title (optional)"
            />
            <textarea
              value={announceBody}
              onChange={(e) => setAnnounceBody(e.target.value)}
              placeholder="Announcement body"
              rows={4}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <textarea
              value={announceMediaUrls}
              onChange={(e) => setAnnounceMediaUrls(e.target.value)}
              placeholder="Media URLs — https images or YouTube/Vimeo links (one per line, max 4)"
              rows={2}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <Button
              disabled={!announceBody.trim() || createAnnouncementMutation.isPending}
              onClick={() => createAnnouncementMutation.mutate()}
            >
              Publish announcement
            </Button>
          </section>
          <section className="glass-panel space-y-3 rounded-xl p-6">
            <h2 className="font-label-caps text-outline">Poll</h2>
            <Input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Question"
            />
            <textarea
              value={pollOptions}
              onChange={(e) => setPollOptions(e.target.value)}
              placeholder="One option per line (2–6)"
              rows={4}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <Button
              disabled={!pollQuestion.trim() || createPollMutation.isPending}
              onClick={() => createPollMutation.mutate()}
            >
              Launch poll
            </Button>
            {activePoll ? (
              <div className="mt-4 rounded-lg border border-outline-variant/40 p-4">
                <p className="text-sm font-medium">{activePoll.question}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {activePoll.totalVotes} votes
                </p>
                <Button
                  variant="ghost"
                  className="mt-3 text-xs"
                  disabled={closePollMutation.isPending}
                  onClick={() => closePollMutation.mutate(activePoll.id)}
                >
                  Close active poll
                </Button>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">No active poll.</p>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'moderation' ? <StudioModerationPanel communityId={communityId} /> : null}

      {tab === 'settings' ? (
        <section className="glass-panel space-y-3 rounded-xl p-6">
          <h2 className="font-label-caps text-outline">Settings</h2>
          <label className="block text-xs text-on-surface-variant">Name</label>
          <Input value={communityName} onChange={(e) => setCommunityName(e.target.value)} />
          <label className="block text-xs text-on-surface-variant">Slug</label>
          <Input value={communitySlug} onChange={(e) => setCommunitySlug(e.target.value)} />
          <label className="block text-xs text-on-surface-variant">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="paid">Paid members only</option>
            <option value="invite">Invite only</option>
          </select>
          <label className="block text-xs text-on-surface-variant">Brand</label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">No brand</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button
            disabled={updateCommunityMutation.isPending || !communityName.trim()}
            onClick={() => updateCommunityMutation.mutate()}
          >
            Save settings
          </Button>
        </section>
      ) : null}

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/studio/communities" className="text-primary hover:underline">
          ← All communities
        </Link>
        {user?.username && community ? (
          <Link
            href={`/${user.username}/c/${community.slug}`}
            className="text-primary hover:underline"
          >
            View public page
          </Link>
        ) : null}
      </div>
    </main>
  );
}
