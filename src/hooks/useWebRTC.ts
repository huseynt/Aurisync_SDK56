import { useRef, useState, useCallback, useEffect } from "react";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { AppState, AppStateStatus, Platform } from "react-native";

type Status = "idle" | "connecting" | "waiting" | "live" | "receiving" | "error";

export type AudioOutput = "earpiece" | "speaker" | "headset";
export type AudioInput  = "mic" | "internal" | "both";

interface UseWebRTCOptions {
  role: "sender" | "receiver";
  audioOutput?: AudioOutput; // only used by receiver
  audioInput?:  AudioInput;  // only used by sender
}

interface UseWebRTCReturn {
  status: Status;
  pin: string | null;
  error: string | null;
  createRoom: (serverUrl: string) => void;
  joinRoom:   (serverUrl: string, pin: string) => void;
  disconnect: () => void;
  setAudioOutput: (output: AudioOutput) => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.l.google.com:5349" },
];

const PING_INTERVAL_MS = 20_000;

const waitForIceGathering = (pc: RTCPeerConnection): Promise<void> =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    // @ts-ignore
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") resolve();
    };
    setTimeout(resolve, 5000);
  });

function getAudioConstraints(input: AudioInput) {
  switch (input) {
    case "mic":
      return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    case "internal":
      return { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    case "both":
    default:
      return true;
  }
}

/**
 * Nauşnik routing düzəltməsi:
 * InCallManager.start() async-dir — start() çağırıldıqdan dərhal sonra
 * setSpeakerphoneOn çağırmaq routing-i override edir.
 * Həll: start() çağırıldıqdan sonra 300ms gözləyib routing tətbiq edirik.
 *
 * Nauşnik üçün xüsusi hal:
 * setForceSpeakerphoneOn(false) + setSpeakerphoneOn(false) — Android
 * AudioManager bütün forced route-ları buraxır və headset-ə avtomatik keçir.
 * Amma InCallManager.start() bu override-ı sıfırlayır, ona görə start()-dan
 * SONRA tətbiq edilməlidir.
 */
function applyAudioOutput(output: AudioOutput): void {
  try {
    switch (output) {
      case "speaker":
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);
        break;
      case "earpiece":
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.setSpeakerphoneOn(false);
        break;
      case "headset":
        // Force false — AudioManager headset-i avtomatik seçir
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.setSpeakerphoneOn(false);
        break;
    }
  } catch (_) {}
}

export function useWebRTC({
  role,
  audioOutput = "earpiece",
  audioInput  = "mic",
}: UseWebRTCOptions): UseWebRTCReturn {
  const [status, setStatus] = useState<Status>("idle");
  const [pin,    setPin]    = useState<string | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  const wsRef             = useRef<WebSocket | null>(null);
  const pcRef             = useRef<RTCPeerConnection | null>(null);
  const localStreamRef    = useRef<MediaStream | null>(null);
  const remoteStreamRef   = useRef<MediaStream | null>(null);
  const roomIdRef         = useRef<string | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pingTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioOutputRef    = useRef<AudioOutput>(audioOutput);
  const audioInputRef     = useRef<AudioInput>(audioInput);
  const isLiveRef         = useRef(false);

  // Həmişə ən son dəyəri saxla
  audioOutputRef.current = audioOutput;
  audioInputRef.current  = audioInput;

  // ─── Ping ────────────────────────────────────────────────────────────────
  const startPing = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }, []);

  const stopPing = useCallback(() => {
    if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    isLiveRef.current = false;
    stopPing();
    try {
      wsRef.current?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (role === "receiver") InCallManager.stop();
    } catch (_) {}
    wsRef.current           = null;
    pcRef.current           = null;
    localStreamRef.current  = null;
    remoteStreamRef.current = null;
    roomIdRef.current       = null;
    pendingCandidates.current = [];
    setPin(null);
    setError(null);
    setStatus("idle");
  }, [role, stopPing]);

  // ─── AppState ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active" && wsRef.current && wsRef.current.readyState !== WebSocket.OPEN && isLiveRef.current) {
        setError("Connection lost in background. Please reconnect.");
        setStatus("error");
        cleanup();
      }
    });
    return () => sub.remove();
  }, [cleanup]);

  // ─── PeerConnection ───────────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // @ts-ignore
    pc.onicecandidate = (e: any) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "ice_candidate",
          candidate: e.candidate.toJSON(),
          roomId: roomIdRef.current,
        }));
      }
    };

    // @ts-ignore
    pc.ontrack = (e: any) => {
      if (role === "receiver" && e.streams?.[0]) {
        remoteStreamRef.current = e.streams[0];
        // start() async-dir — 300ms sonra routing tətbiq et ki, start() bitsin
        InCallManager.start({ media: "audio", auto: false, ringback: "" });
        setTimeout(() => {
          applyAudioOutput(audioOutputRef.current);
        }, 300);
      }
    };

    // @ts-ignore
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("ICE state:", state);
      if (state === "connected" || state === "completed") {
        isLiveRef.current = true;
        setStatus(role === "sender" ? "live" : "receiving");
      } else if (state === "failed" || state === "disconnected") {
        setError("Connection lost. Please try again.");
        setStatus("error");
        cleanup();
      }
    };

    return pc;
  }, [role, cleanup]);

  // ─── Pending ICE ─────────────────────────────────────────────────────────
  const addPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidates.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
    }
    pendingCandidates.current = [];
  }, []);

  // ─── Message handler ──────────────────────────────────────────────────────
  const handleMessage = useCallback(
    async (data: string) => {
      let msg: any;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === "pong" || msg.type === "welcome" || msg.type === "ping") return;

      const pc = pcRef.current;

      switch (msg.type) {
        case "room_created": {
          roomIdRef.current = msg.roomId;
          setPin(msg.roomId);
          setStatus("waiting");
          break;
        }

        case "peer_joined": {
          if (role !== "sender" || !pc) break;
          try {
            if (Platform.OS === "android") {
              const { PermissionsAndroid } = await import("react-native");
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                  title: "Microphone Permission",
                  message: "Aurisync needs microphone access to stream audio.",
                  buttonPositive: "Allow",
                  buttonNegative: "Deny",
                }
              );
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                setError("Microphone permission denied.");
                setStatus("error");
                break;
              }
            }

            const constraints = getAudioConstraints(audioInputRef.current);
            const stream = await mediaDevices.getUserMedia({ audio: constraints, video: false });
            localStreamRef.current = stream;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer({});
            await pc.setLocalDescription(new RTCSessionDescription(offer));
            await waitForIceGathering(pc);

            wsRef.current?.send(JSON.stringify({
              type: "offer",
              sdp: pc.localDescription,
              roomId: roomIdRef.current,
            }));
          } catch (err: any) {
            setError(err?.message ?? "Microphone error");
            setStatus("error");
          }
          break;
        }

        case "answer": {
          if (role !== "sender" || !pc) break;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await addPendingCandidates(pc);
          } catch (err: any) {
            setError(err?.message ?? "SDP error");
            setStatus("error");
          }
          break;
        }

        case "room_joined": {
          roomIdRef.current = msg.roomId;
          setStatus("waiting");
          break;
        }

        case "offer": {
          if (role !== "receiver" || !pc) break;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await addPendingCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(new RTCSessionDescription(answer));
            await waitForIceGathering(pc);

            wsRef.current?.send(JSON.stringify({
              type: "answer",
              sdp: pc.localDescription,
              roomId: roomIdRef.current,
            }));
          } catch (err: any) {
            setError(err?.message ?? "SDP error");
            setStatus("error");
          }
          break;
        }

        case "ice_candidate": {
          if (!pc) break;
          const candidate = new RTCIceCandidate(msg.candidate);
          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(candidate); } catch (_) {}
          } else {
            pendingCandidates.current.push(msg.candidate);
          }
          break;
        }

        case "peer_disconnected": {
          setError("The other device disconnected.");
          setStatus("error");
          cleanup();
          break;
        }

        case "error": {
          // "Invalid signal format" artıq gəlməyəcək, amma gəlsə sessizce log et
          console.warn("Server error:", msg.message);
          // Yalnız real xətalarda UI-ı göstər
          if (msg.message !== "Invalid signal format" && msg.message !== "Unknown signal type") {
            setError(msg.message ?? "Server error");
            setStatus("error");
          }
          break;
        }
      }
    },
    [role, addPendingCandidates, cleanup]
  );

  // ─── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(
    (serverUrl: string, onOpen: (ws: WebSocket) => void) => {
      setStatus("connecting");
      setError(null);

      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;
      const pc = createPeerConnection();
      pcRef.current = pc;

      ws.onopen = () => { startPing(); onOpen(ws); };
      ws.onmessage = (e) => handleMessage(e.data);
      ws.onerror = (e: any) => {
        setError(`WS Error: ${e?.message || "WebSocket error"}`);
        setStatus("error");
        cleanup();
      };
      ws.onclose = (e: any) => {
        if (isLiveRef.current) {
          setError(`Connection closed (code=${e.code}). Please reconnect.`);
          setStatus("error");
          cleanup();
        }
      };
    },
    [createPeerConnection, handleMessage, cleanup, startPing]
  );

  const createRoom = useCallback(
    (serverUrl: string) => connect(serverUrl, (ws) => {
      ws.send(JSON.stringify({ type: "create_room", role: "sender" }));
    }),
    [connect]
  );

  const joinRoom = useCallback(
    (serverUrl: string, pinCode: string) => connect(serverUrl, (ws) => {
      ws.send(JSON.stringify({ type: "join_room", roomId: pinCode, role: "receiver" }));
    }),
    [connect]
  );

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
      wsRef.current.send(JSON.stringify({ type: "disconnect", roomId: roomIdRef.current }));
    }
    cleanup();
  }, [cleanup]);

  const setAudioOutput = useCallback((output: AudioOutput) => {
    audioOutputRef.current = output;
    if (remoteStreamRef.current) {
      applyAudioOutput(output);
    }
  }, []);

  return { status, pin, error, createRoom, joinRoom, disconnect, setAudioOutput };
}