import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { messageGatewayWsUrl } from '@/lib/runtime-config';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
type RecordingState = 'idle' | 'recording' | 'uploading';

type SignalPayload =
  | { type: 'video.offer'; description: RTCSessionDescriptionInit }
  | { type: 'video.answer'; description: RTCSessionDescriptionInit }
  | { type: 'video.ice-candidate'; candidate: RTCIceCandidateInit }
  | { type: 'video.recording.started'; recording_label?: string }
  | { type: 'video.recording.stopped'; recording_label?: string; duration_seconds?: number };

type VideoCallOptions = {
  roomId: string | null;
  onRecordingReady: (payload: { blob: Blob; durationSeconds: number; mimeType: string }) => Promise<void>;
};

function buildSocketUrl(roomId: string, clientId: string, role: string): string {
  const url = new URL(`${messageGatewayWsUrl}/${roomId}`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('role', role);
  return url.toString();
}

function supportedRecorderMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const supported = candidates.find((candidate) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate));
  return supported ?? 'video/webm';
}

export function useVideoCall({ roomId, onRecordingReady }: VideoCallOptions) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const agentSocketRef = useRef<WebSocket | null>(null);
  const visitorSocketRef = useRef<WebSocket | null>(null);
  const agentPeerRef = useRef<RTCPeerConnection | null>(null);
  const visitorPeerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const visitorStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const clientIds = useMemo(
    () => ({
      agent: `admin-video-${crypto.randomUUID().slice(0, 8)}`,
      visitor: `visitor-video-${crypto.randomUUID().slice(0, 8)}`,
    }),
    [],
  );

  const sendAgentSignal = useCallback((payload: SignalPayload) => {
    agentSocketRef.current?.send(JSON.stringify(payload));
  }, []);

  const cleanup = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    recordingStartedAtRef.current = null;
    recorderChunksRef.current = [];

    for (const socket of [agentSocketRef.current, visitorSocketRef.current]) {
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }
    }
    agentSocketRef.current = null;
    visitorSocketRef.current = null;

    for (const peer of [agentPeerRef.current, visitorPeerRef.current]) {
      peer?.getSenders().forEach((sender) => sender.track?.stop());
      peer?.close();
    }
    agentPeerRef.current = null;
    visitorPeerRef.current = null;

    for (const stream of [localStreamRef.current, visitorStreamRef.current, remoteStreamRef.current]) {
      stream?.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    visitorStreamRef.current = null;
    remoteStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRecordingState('idle');
    setConnectionState('idle');
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const connect = useCallback(async () => {
    if (!roomId) {
      setError('没有可用的会话房间，无法建立视频连接');
      return;
    }

    cleanup();
    setError(null);
    setConnectionState('connecting');

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const visitorStream = localStream.clone();
      const remoteStream = new MediaStream();
      localStreamRef.current = localStream;
      visitorStreamRef.current = visitorStream;
      remoteStreamRef.current = remoteStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

      const agentPeer = new RTCPeerConnection();
      const visitorPeer = new RTCPeerConnection();
      agentPeerRef.current = agentPeer;
      visitorPeerRef.current = visitorPeer;

      localStream.getTracks().forEach((track) => agentPeer.addTrack(track, localStream));
      visitorStream.getTracks().forEach((track) => visitorPeer.addTrack(track, visitorStream));

      agentPeer.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
        setConnectionState('connected');
      };

      const agentSocket = new WebSocket(buildSocketUrl(roomId, clientIds.agent, 'agent'));
      const visitorSocket = new WebSocket(buildSocketUrl(roomId, clientIds.visitor, 'customer'));
      agentSocketRef.current = agentSocket;
      visitorSocketRef.current = visitorSocket;

      await Promise.all(
        [agentSocket, visitorSocket].map(
          (socket) =>
            new Promise<void>((resolve, reject) => {
              socket.addEventListener('open', () => resolve(), { once: true });
              socket.addEventListener('error', () => reject(new Error('视频信令连接失败')), { once: true });
            }),
        ),
      );

      agentPeer.onicecandidate = (event) => {
        if (event.candidate) {
          sendAgentSignal({ type: 'video.ice-candidate', candidate: event.candidate.toJSON() });
        }
      };
      visitorPeer.onicecandidate = (event) => {
        if (event.candidate) {
          visitorSocket.send(JSON.stringify({ type: 'video.ice-candidate', candidate: event.candidate.toJSON() }));
        }
      };

      agentSocket.onmessage = async (event) => {
        const payload = JSON.parse(event.data) as SignalPayload & { sender_id?: string };
        if (payload.type === 'video.answer') {
          await agentPeer.setRemoteDescription(payload.description);
        }
        if (payload.type === 'video.ice-candidate') {
          await agentPeer.addIceCandidate(payload.candidate);
        }
      };

      visitorSocket.onmessage = async (event) => {
        const payload = JSON.parse(event.data) as SignalPayload;
        if (payload.type === 'video.offer') {
          await visitorPeer.setRemoteDescription(payload.description);
          const answer = await visitorPeer.createAnswer();
          await visitorPeer.setLocalDescription(answer);
          visitorSocket.send(JSON.stringify({ type: 'video.answer', description: answer }));
        }
        if (payload.type === 'video.ice-candidate') {
          await visitorPeer.addIceCandidate(payload.candidate);
        }
      };

      const offer = await agentPeer.createOffer();
      await agentPeer.setLocalDescription(offer);
      sendAgentSignal({ type: 'video.offer', description: offer });
      setConnectionState('connected');
    } catch (cause) {
      cleanup();
      setConnectionState('error');
      setError(cause instanceof Error ? cause.message : '建立视频连接失败');
    }
  }, [cleanup, clientIds.agent, clientIds.visitor, onRecordingReady, roomId, sendAgentSignal]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    let source = remoteStreamRef.current ?? localStreamRef.current;
    if (!source) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStreamRef.current = fallbackStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = fallbackStream;
        }
        source = fallbackStream;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '当前没有可录制的视频流');
        return;
      }
    }
    if (recordingState === 'recording') {
      return;
    }

    const mimeType = supportedRecorderMimeType();
    const recorder = new MediaRecorder(source, { mimeType });
    recorderChunksRef.current = [];
    recordingStartedAtRef.current = performance.now();
    recorderRef.current = recorder;
    setRecordingState('recording');
    sendAgentSignal({ type: 'video.recording.started', recording_label: '浏览器录制' });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recorderChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = async () => {
      const blob = new Blob(recorderChunksRef.current, { type: mimeType });
      const durationSeconds = Math.max(
        1,
        Math.round(((performance.now() - (recordingStartedAtRef.current ?? performance.now())) / 1000)),
      );
      setRecordingState('uploading');
      sendAgentSignal({ type: 'video.recording.stopped', recording_label: '浏览器录制', duration_seconds: durationSeconds });
      try {
        await onRecordingReady({ blob, durationSeconds, mimeType });
        setRecordingState('idle');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '上传录制文件失败');
        setRecordingState('idle');
      }
    };
    recorder.start(250);
  }, [onRecordingReady, recordingState, sendAgentSignal]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    connectionState,
    recordingState,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}
