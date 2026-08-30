'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@forge/design-system';
import { env } from '@/env';
import { CommunityStageRaiseHandPanel } from '@/components/Community/CommunityStageRaiseHandPanel';

const LIVEKIT_URL = env.NEXT_PUBLIC_LIVEKIT_URL;

type JoinPayload = {
  token: string;
  livekitUrl: string;
  canPublish: boolean;
  isHost: boolean;
  roomType: string;
  roomName: string;
};

function VoiceRoomContent({ canPublish }: { canPublish: boolean }) {
  const tracks = useTracks([Track.Source.Microphone]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        {tracks.length} participant{tracks.length === 1 ? '' : 's'} with audio
      </p>
      <RoomAudioRenderer />
      <ControlBar
        controls={{
          camera: false,
          screenShare: false,
          microphone: canPublish,
        }}
      />
    </div>
  );
}

export default function CommunityVoiceRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { isGuest } = useAuth();
  const communityId = params.communityId as string;
  const roomId = params.roomId as string;
  const [joinPayload, setJoinPayload] = useState<JoinPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadToken = useCallback(async () => {
    try {
      const { data } = await api.post<{ data: JoinPayload }>(
        `/communities/${communityId}/rooms/${roomId}/token`,
      );
      setJoinPayload(data.data);
      setError(null);
    } catch {
      setError('Could not join room. Check membership tier, sign-in, and LiveKit config.');
    }
  }, [communityId, roomId]);

  useEffect(() => {
    if (isGuest || !communityId || !roomId) return;
    void loadToken();
  }, [communityId, roomId, isGuest, loadToken, refreshToken]);

  if (isGuest) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <p className="text-sm">Sign in to join this room.</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <p className="text-sm text-error">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => router.back()}>
          Go back
        </Button>
      </main>
    );
  }

  if (!joinPayload || !LIVEKIT_URL) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <p className="text-sm text-on-surface-variant">Connecting to room…</p>
      </main>
    );
  }

  const isStage = joinPayload.roomType === 'stage';
  const title = isStage ? 'Stage room' : joinPayload.roomType === 'breakout' ? 'Breakout room' : 'Voice room';

  return (
    <main className="mx-auto max-w-lg space-y-4 px-5 py-8">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-on-surface-variant">{joinPayload.roomName}</p>
      </div>

      {isStage ? (
        <CommunityStageRaiseHandPanel
          communityId={communityId}
          roomId={roomId}
          isHost={joinPayload.isHost}
          canPublish={joinPayload.canPublish}
          onSpeakerApproved={() => setRefreshToken((n) => n + 1)}
        />
      ) : null}

      <LiveKitRoom
        key={`${joinPayload.token}-${joinPayload.canPublish}`}
        serverUrl={LIVEKIT_URL}
        token={joinPayload.token}
        connect
        audio
        video={false}
        onDisconnected={() => router.back()}
      >
        <VoiceRoomContent canPublish={joinPayload.canPublish} />
      </LiveKitRoom>
    </main>
  );
}
