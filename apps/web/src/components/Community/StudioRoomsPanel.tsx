'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SubscriberPicker } from '@/components/Community/SubscriberPicker';

type Room = {
  id: string;
  name: string;
  slug: string;
  roomType: string;
  description?: string | null;
  maxParticipants?: number | null;
  settings?: { requiredTierId?: string; parentRoomId?: string };
};

type Tier = { id: string; name: string };
type RoomPermission = { id: string; userId: string; permission: string };

interface Props {
  communityId: string;
}

const LIVEKIT_ENABLED = !!process.env.NEXT_PUBLIC_LIVEKIT_URL;

export function StudioRoomsPanel({ communityId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState('text');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [requiredTierId, setRequiredTierId] = useState('');
  const [parentRoomId, setParentRoomId] = useState('');
  const [expandedPermRoomId, setExpandedPermRoomId] = useState<string | null>(null);
  const [permUserId, setPermUserId] = useState('');
  const [permType, setPermType] = useState('send');

  const { data: rooms } = useQuery({
    queryKey: ['community-rooms', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Room[] }>(`/communities/${communityId}/rooms`);
      return data.data ?? [];
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ['creator-tiers', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Tier[] }>(`/creators/${user!.id}/tiers`);
      return data.data ?? [];
    },
  });

  const liveRooms = (rooms ?? []).filter((r) => r.roomType === 'voice' || r.roomType === 'stage');

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/rooms`, {
        name: name.trim(),
        description: description.trim() || undefined,
        roomType,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        requiredTierId: requiredTierId || undefined,
        parentRoomId: roomType === 'breakout' && parentRoomId ? parentRoomId : undefined,
      });
    },
    onSuccess: () => {
      setName('');
      setDescription('');
      setRoomType('text');
      setMaxParticipants('');
      setRequiredTierId('');
      setParentRoomId('');
      void qc.invalidateQueries({ queryKey: ['community-rooms', communityId] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/rooms/${roomId}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['community-rooms', communityId] }),
  });

  const tierName = (tierId?: string) =>
    (tiers ?? []).find((t) => t.id === tierId)?.name ?? 'VIP tier';

  const { data: roomPermissions } = useQuery({
    queryKey: ['room-permissions', communityId, expandedPermRoomId],
    enabled: !!expandedPermRoomId,
    queryFn: async () => {
      const { data } = await api.get<{ data: RoomPermission[] }>(
        `/creators/me/communities/${communityId}/rooms/${expandedPermRoomId}/permissions`,
      );
      return data.data ?? [];
    },
  });

  const grantPermMutation = useMutation({
    mutationFn: async ({ roomId, userId, permission }: { roomId: string; userId: string; permission: string }) => {
      await api.post(`/creators/me/communities/${communityId}/rooms/${roomId}/permissions`, {
        userId,
        permission,
      });
    },
    onSuccess: () => {
      setPermUserId('');
      void qc.invalidateQueries({ queryKey: ['room-permissions', communityId, expandedPermRoomId] });
    },
  });

  const revokePermMutation = useMutation({
    mutationFn: async ({
      roomId,
      userId,
      permission,
    }: {
      roomId: string;
      userId: string;
      permission: string;
    }) => {
      await api.delete(
        `/creators/me/communities/${communityId}/rooms/${roomId}/permissions/${userId}`,
        { data: { permission } },
      );
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['room-permissions', communityId, expandedPermRoomId] }),
  });

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-xs text-outline">Create room</h2>
        <p className="text-xs text-on-surface-variant">
          Text rooms are always available. Voice/stage/breakout require LiveKit (
          {LIVEKIT_ENABLED ? 'configured' : 'set NEXT_PUBLIC_LIVEKIT_URL'}).
        </p>
        <Input placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select
          className="w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm"
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
        >
          <option value="text">Text</option>
          <option value="voice" disabled={!LIVEKIT_ENABLED}>
            Voice
          </option>
          <option value="stage" disabled={!LIVEKIT_ENABLED}>
            Stage (raise hand)
          </option>
          <option value="breakout" disabled={!LIVEKIT_ENABLED}>
            Breakout
          </option>
        </select>
        {roomType !== 'text' ? (
          <Input
            type="number"
            min={2}
            placeholder="Max participants (optional)"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
        ) : null}
        {roomType !== 'text' && (tiers ?? []).length > 0 ? (
          <select
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm"
            value={requiredTierId}
            onChange={(e) => setRequiredTierId(e.target.value)}
          >
            <option value="">Open to all members</option>
            {(tiers ?? []).map((tier) => (
              <option key={tier.id} value={tier.id}>
                VIP — {tier.name} and above
              </option>
            ))}
          </select>
        ) : null}
        {roomType === 'breakout' && liveRooms.length > 0 ? (
          <select
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm"
            value={parentRoomId}
            onChange={(e) => setParentRoomId(e.target.value)}
          >
            <option value="">Select parent voice/stage room</option>
            {liveRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.roomType})
              </option>
            ))}
          </select>
        ) : null}
        <Button
          disabled={createMutation.isPending || !name.trim()}
          onClick={() => createMutation.mutate()}
        >
          Create room
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-label-caps text-xs text-outline">Active rooms</h2>
        {(rooms ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No rooms yet.</p>
        ) : (
          (rooms ?? []).map((room) => (
            <div
              key={room.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-outline-variant/30 p-4"
            >
              <div>
                <p className="font-medium text-sm">{room.name}</p>
                <p className="text-xs text-outline">
                  {room.roomType} · /{room.slug}
                  {room.settings?.requiredTierId
                    ? ` · ${tierName(room.settings.requiredTierId)}`
                    : ''}
                </p>
                {room.description ? (
                  <p className="mt-1 text-xs text-on-surface-variant">{room.description}</p>
                ) : null}
                {room.roomType === 'text' ? (
                  <Link
                    href={`/community/${communityId}/text/${room.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Open text room →
                  </Link>
                ) : room.roomType !== 'text' && LIVEKIT_ENABLED ? (
                  <Link
                    href={`/community/${communityId}/voice/${room.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Open room →
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={() =>
                    setExpandedPermRoomId(expandedPermRoomId === room.id ? null : room.id)
                  }
                >
                  {expandedPermRoomId === room.id ? 'Hide permissions' : 'Permissions'}
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate(room.id)}
                >
                  Deactivate
                </Button>
              </div>
              {expandedPermRoomId === room.id ? (
                <div className="mt-3 w-full space-y-2 border-t border-outline-variant/30 pt-3">
                  <p className="text-xs font-medium text-outline">Room-level overrides</p>
                  {(roomPermissions ?? []).length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No custom permissions yet.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {(roomPermissions ?? []).map((perm) => (
                        <li
                          key={perm.id}
                          className="flex items-center justify-between rounded border border-outline-variant/30 px-2 py-1"
                        >
                          <span>
                            {perm.userId.slice(0, 8)} · {perm.permission}
                          </span>
                          <Button
                            variant="ghost"
                            className="px-2 py-0 text-xs text-error"
                            disabled={revokePermMutation.isPending}
                            onClick={() =>
                              revokePermMutation.mutate({
                                roomId: room.id,
                                userId: perm.userId,
                                permission: perm.permission,
                              })
                            }
                          >
                            Revoke
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <select
                    className="w-full rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm"
                    value={permType}
                    onChange={(e) => setPermType(e.target.value)}
                  >
                    <option value="view">View</option>
                    <option value="send">Send</option>
                    <option value="moderate">Moderate</option>
                  </select>
                  <SubscriberPicker
                    value={permUserId}
                    onChange={setPermUserId}
                    placeholder="Search member to grant permission"
                  />
                  <Button
                    className="text-xs"
                    disabled={!permUserId || grantPermMutation.isPending}
                    onClick={() =>
                      grantPermMutation.mutate({
                        roomId: room.id,
                        userId: permUserId,
                        permission: permType,
                      })
                    }
                  >
                    Grant permission
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
