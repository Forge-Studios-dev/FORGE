'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { api } from '@/lib/api';

type Props = {
  streamId: string;
  livekitUrl?: string;
  onBroadcastingChange?: (active: boolean) => void;
};

function LocalPreview() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const cam = tracks.find((t) => t.participant.isLocal);
  if (!cam) return <p className="text-sm text-on-surface-variant">Starting camera…</p>;
  return <VideoTrack trackRef={cam} className="aspect-video w-full rounded-lg object-cover" />;
}

function BroadcastControls({
  streamId,
  onStop,
}: {
  streamId: string;
  onStop: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const [egressStarted, setEgressStarted] = useState(false);

  useEffect(() => {
    if (!localParticipant || egressStarted) return;
    void (async () => {
      try {
        await api.post(`/streams/${streamId}/broadcast/browser/start`);
        setEgressStarted(true);
      } catch {
        /* egress may retry from parent */
      }
    })();
  }, [localParticipant, egressStarted, streamId]);

  return (
    <button
      type="button"
      onClick={onStop}
      className="rounded-lg border border-error/40 px-4 py-2 text-sm font-medium text-error"
    >
      Stop browser broadcast
    </button>
  );
}

export function BrowserGoLivePanel({ streamId, livekitUrl, onBroadcastingChange }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const stop = useCallback(async () => {
    try {
      await api.post(`/streams/${streamId}/broadcast/browser/stop`);
    } catch {
      /* ignore */
    }
    setToken(null);
    setRoomName(null);
    onBroadcastingChange?.(false);
  }, [streamId, onBroadcastingChange]);

  async function start() {
    setStarting(true);
    setError('');
    try {
      const { data } = await api.post<{
        data: { token: string; roomName: string };
      }>(`/streams/${streamId}/broadcast/browser/token`);
      setToken(data.data.token);
      setRoomName(data.data.roomName);
      onBroadcastingChange?.(true);
    } catch {
      setError('Browser broadcasting is unavailable. Use OBS instead.');
    } finally {
      setStarting(false);
    }
  }

  if (!livekitUrl) {
    return (
      <p className="text-xs text-on-surface-variant">
        Browser go-live requires LiveKit configuration (LIVEKIT_URL).
      </p>
    );
  }

  if (!token || !roomName) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-on-surface-variant">
          Broadcast from your camera and microphone without OBS.
        </p>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <button
          type="button"
          disabled={starting}
          onClick={() => void start()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
        >
          {starting ? 'Connecting…' : 'Start browser broadcast'}
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect
      video
      audio
      onDisconnected={() => void stop()}
      className="space-y-3"
    >
      <LocalPreview />
      <RoomAudioRenderer />
      <BroadcastControls streamId={streamId} onStop={() => void stop()} />
    </LiveKitRoom>
  );
}
