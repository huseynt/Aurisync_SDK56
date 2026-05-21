import { useRef, useState, useCallback } from "react";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";

type Status = "idle" | "connecting" | "waiting" | "live" | "receiving" | "error";

interface UseWebRTCOptions {
  role: "sender" | "receiver";
}

interface UseWebRTCReturn {
  status: Status;
  pin: string | null;
  error: string | null;
  createRoom: (serverUrl: string) => void;
  joinRoom: (serverUrl: string, pin: string) => void;
  disconnect: () => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTC({ role }: UseWebRTCOptions): UseWebRTCReturn {
  const [status, setStatus] = useState<Status>("idle");
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    try {
      wsRef.current?.close();
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (role === "receiver") InCallManager.stop();
    } catch (_) {}
    wsRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;
    roomIdRef.current = null;
    pendingCandidates.current = [];
    setPin(null);
    setError(null);
    setStatus("idle");
  }, [role]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // @ts-ignore
    pc.onicecandidate = (e: any) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice_candidate",
            candidate: e.candidate.toJSON(),
            roomId: roomIdRef.current,
          })
        );
      }
    };

    // @ts-ignore
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        setStatus(role === "sender" ? "live" : "receiving");
      } else if (state === "failed" || state === "disconnected") {
        setError("Connection lost. Please try again.");
        setStatus("error");
        cleanup();
      }
    };

    return pc;
  }, [role, cleanup]);

  const addPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const candidate of pendingCandidates.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_) {}
    }
    pendingCandidates.current = [];
  }, []);

  const handleMessage = useCallback(
    async (data: string) => {
      let msg: any;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      const pc = pcRef.current;

      switch (msg.type) {
        // --- SENDER ---
        case "room_created": {
          roomIdRef.current = msg.roomId;
          setPin(msg.roomId);
          setStatus("waiting");
          break;
        }

        case "peer_joined": {
          if (role !== "sender" || !pc) break;
          try {
            // Runtime permission sorğusu
            const { PermissionsAndroid, Platform } = await import("react-native");
            
            if (Platform.OS === "android") {
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

            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer({});
            await pc.setLocalDescription(new RTCSessionDescription(offer));

            wsRef.current?.send(
              JSON.stringify({
                type: "offer",
                sdp: offer,
                roomId: roomIdRef.current,
              })
            );
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

        // --- RECEIVER ---
        case "room_joined": {
          roomIdRef.current = msg.roomId;
          setStatus("waiting");
          break;
        }

        case "offer": {
          if (role !== "receiver" || !pc) break;
          try {
            // iOS + Android audio fix — BEFORE createAnswer
            InCallManager.start({ media: "audio" });
            InCallManager.setSpeakerphoneOn(true);

            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await addPendingCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(new RTCSessionDescription(answer));

            wsRef.current?.send(
              JSON.stringify({
                type: "answer",
                sdp: answer,
                roomId: roomIdRef.current,
              })
            );
          } catch (err: any) {
            setError(err?.message ?? "SDP error");
            setStatus("error");
          }
          break;
        }

        // --- SHARED ---
        case "ice_candidate": {
          if (!pc) break;
          const candidate = new RTCIceCandidate(msg.candidate);
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (_) {}
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
          setError(msg.message ?? "Server error");
          setStatus("error");
          break;
        }
      }
    },
    [role, addPendingCandidates, cleanup]
  );

  const connect = useCallback(
    (serverUrl: string, onOpen: (ws: WebSocket) => void) => {
      setStatus("connecting");
      setError(null);

      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;
      const pc = createPeerConnection();
      pcRef.current = pc;

      ws.onopen = () => onOpen(ws);

      ws.onmessage = (e) => handleMessage(e.data);

      ws.onerror = () => {
        setError("Cannot reach signaling server.");
        setStatus("error");
        cleanup();
      };

      ws.onclose = () => {
        if (status === "live" || status === "receiving") {
          setError("Server connection closed.");
          setStatus("error");
        }
      };
    },
    [createPeerConnection, handleMessage, cleanup, status]
  );

  const createRoom = useCallback(
    (serverUrl: string) => {
      connect(serverUrl, (ws) => {
        ws.send(JSON.stringify({ type: "create_room", role: "sender" }));
      });
    },
    [connect]
  );

  const joinRoom = useCallback(
    (serverUrl: string, pinCode: string) => {
      connect(serverUrl, (ws) => {
        ws.send(JSON.stringify({ type: "join_room", roomId: pinCode, role: "receiver" }));
      });
    },
    [connect]
  );

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && roomIdRef.current) {
      wsRef.current.send(
        JSON.stringify({ type: "disconnect", roomId: roomIdRef.current })
      );
    }
    cleanup();
  }, [cleanup]);

  return { status, pin, error, createRoom, joinRoom, disconnect };
}