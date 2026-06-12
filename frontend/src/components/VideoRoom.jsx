import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Monitor, Copy } from 'lucide-react';
import socket from '../socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
};

const VideoRoom = ({ roomId, onLeave }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [copied, setCopied] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [statusText, setStatusText] = useState('Kamera yuklanmoqda...');
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const createPeerConnection = useCallback((targetId) => {
    // Clean up any existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    console.log('[WebRTC] PeerConnection yaratilmoqda, target:', targetId);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    remoteUserIdRef.current = targetId;

    // Add ALL local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('[WebRTC] Track qo\'shildi:', track.kind);
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track olindi:', event.track.kind);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setIsConnected(true);
      setIsWaiting(false);
      setStatusText('Ulangan');
      startTimer();
    };

    // Send ICE candidates to the other user
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate jo\'natilmoqda');
        socket.emit('ice-candidate', {
          target: targetId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE holati:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        setIsConnected(true);
        setIsWaiting(false);
        setStatusText('Ulangan');
      }
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setStatusText('Aloqa uzildi...');
        setIsConnected(false);
        setIsWaiting(true);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }
    };

    pc.onnegotiationneeded = () => {
      console.log('[WebRTC] Negotiation kerak');
    };

    return pc;
  }, [startTimer]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // 1. Get camera & microphone
      try {
        console.log('[Media] Kamera va mikrofon so\'ralmoqda...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        console.log('[Media] Kamera tayyor! Tracklar:', stream.getTracks().map(t => t.kind));
        setStatusText('Do\'stingizni kutmoqdamiz...');
        
        // Announce we are ready in the room
        socket.emit('ready', roomId);
      } catch (err) {
        console.error('[Media] Kamera xatosi:', err);
        setStatusText('Kamera yoki mikrofon ruxsati berilmadi!');
        return;
      }

      // 2. Socket events
      socket.on('user-ready', async (userId) => {
        if (!mounted) return;
        console.log('[Socket] Foydalanuvchi tayyor:', userId);
        setStatusText('Ulanmoqda...');
        
        const pc = createPeerConnection(userId);
        
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await pc.setLocalDescription(offer);
          console.log('[WebRTC] Offer jo\'natildi');
          socket.emit('offer', { target: userId, sdp: pc.localDescription });
        } catch (err) {
          console.error('[WebRTC] Offer xatosi:', err);
        }
      });

      socket.on('offer', async (data) => {
        if (!mounted) return;
        console.log('[Socket] Offer olindi:', data.caller);
        setStatusText('Ulanmoqda...');
        
        const pc = createPeerConnection(data.caller);
        
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('[WebRTC] Answer jo\'natildi');
          socket.emit('answer', { target: data.caller, sdp: pc.localDescription });
        } catch (err) {
          console.error('[WebRTC] Answer xatosi:', err);
        }
      });

      socket.on('answer', async (data) => {
        if (!mounted) return;
        console.log('[Socket] Answer olindi');
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
          try {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.sdp)
            );
          } catch (err) {
            console.error('[WebRTC] setRemoteDescription xatosi:', err);
          }
        }
      });

      socket.on('ice-candidate', async (data) => {
        if (!mounted) return;
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          } catch (err) {
            console.error('[WebRTC] ICE candidate xatosi:', err);
          }
        }
      });

      socket.on('user-left', () => {
        if (!mounted) return;
        console.log('[Socket] Foydalanuvchi chiqib ketdi');
        setIsConnected(false);
        setIsWaiting(true);
        setStatusText('Do\'stingiz chiqib ketdi. Kutmoqdamiz...');
        setCallDuration(0);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        cleanup();
      });
    };

    init();

    return () => {
      mounted = false;
      socket.off('user-ready');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
      cleanup();
    };
  }, [createPeerConnection, cleanup]);

  const handleEndCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    cleanup();
    socket.disconnect();
    onLeave();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-4 md:px-6 glass border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success' : 'bg-warning animate-pulse'}`} />
          <span className="text-gray-300 font-medium text-sm">
            {statusText}
          </span>
          {isConnected && (
            <span className="text-gray-500 text-sm font-mono ml-2">{formatTime(callDuration)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs md:text-sm">Xona:</span>
          <span className="text-white font-mono font-bold tracking-wider text-sm">{roomId}</span>
          <button onClick={handleCopyCode} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="Nusxalash">
            <Copy size={14} className={copied ? 'text-success' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative p-2 md:p-4">
        {/* Remote Video (Full screen) */}
        <div className="w-full h-full rounded-2xl overflow-hidden bg-surface-light relative">
          {isWaiting ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <div className="w-20 h-20 rounded-full bg-surface-lighter flex items-center justify-center mb-6 animate-pulse">
                <Monitor size={36} className="text-gray-500" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2 text-center">{statusText}</h3>
              <p className="text-gray-500 mb-4 text-sm">Xona kodini ulashing:</p>
              <div className="bg-surface rounded-xl px-5 py-3 flex items-center gap-3 border border-white/10">
                <span className="text-xl md:text-2xl font-bold tracking-[0.4em] font-mono text-primary">{roomId}</span>
                <button onClick={handleCopyCode} className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                  <Copy size={18} className={copied ? 'text-success' : 'text-gray-400'} />
                </button>
              </div>
              {copied && <p className="text-success text-sm mt-2">✓ Nusxalandi!</p>}
            </div>
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 w-32 h-24 md:w-56 md:h-40 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-surface-light">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {isVideoOff && (
            <div className="absolute inset-0 bg-surface-light flex items-center justify-center">
              <VideoOff size={24} className="text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="h-20 md:h-24 flex items-center justify-center gap-4 md:gap-5 glass border-t border-white/5">
        <button
          onClick={toggleMute}
          className={`btn-control ${isMuted ? 'bg-danger/20 text-danger' : 'bg-surface-lighter text-white hover:bg-surface-lighter/70'}`}
          title={isMuted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`btn-control ${isVideoOff ? 'bg-danger/20 text-danger' : 'bg-surface-lighter text-white hover:bg-surface-lighter/70'}`}
          title={isVideoOff ? 'Kamerani yoqish' : "Kamerani o'chirish"}
        >
          {isVideoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
        </button>

        <button
          onClick={handleEndCall}
          className="btn-control bg-danger text-white hover:bg-red-600 w-16 h-16 shadow-lg shadow-danger/30"
          title="Qo'ng'iroqni tugatish"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
};

export default VideoRoom;
