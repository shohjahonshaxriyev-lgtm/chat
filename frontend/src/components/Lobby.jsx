import React, { useState } from 'react';
import { Video, Users, Copy, ArrowRight, Sparkles } from 'lucide-react';
import socket from '../socket';

const Lobby = ({ onJoinRoom }) => {
  const [joinCode, setJoinCode] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = () => {
    socket.connect();
    socket.emit('create-room', (data) => {
      setCreatedRoom(data.roomId);
      setError('');
    });
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      setError('Xona kodini kiriting');
      return;
    }
    socket.connect();
    socket.emit('join-room', joinCode.toUpperCase(), (data) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      onJoinRoom(joinCode.toUpperCase());
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdRoom);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartCall = () => {
    onJoinRoom(createdRoom);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/15 blur-[150px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-5 animate-float border border-primary/30">
            <Video size={40} className="text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Video Suhbat</h1>
          <p className="text-gray-400 text-lg">Yaqinlaringiz bilan jonli video aloqa</p>
        </div>

        {/* Main Card */}
        <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl">
          
          {!createdRoom ? (
            <>
              {/* Create Room */}
              <button
                onClick={handleCreateRoom}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-lg shadow-lg shadow-primary/25 cursor-pointer mb-6"
              >
                <Sparkles size={22} />
                Yangi xona yaratish
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-gray-500 text-sm font-medium">yoki</span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

              {/* Join Room */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Xona kodini kiriting..."
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                  className="w-full bg-surface-lighter/50 border border-white/10 text-white placeholder-gray-500 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-center text-xl tracking-[0.3em] font-mono uppercase"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinRoom}
                  className="w-full bg-surface-lighter hover:bg-surface-lighter/80 text-white font-semibold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 border border-white/10 cursor-pointer"
                >
                  <Users size={20} />
                  Xonaga qo'shilish
                </button>
              </div>
            </>
          ) : (
            /* Room Created - Show Code */
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={30} className="text-success" />
              </div>
              <div>
                <p className="text-gray-400 mb-2">Xona yaratildi! Kodni do'stingizga yuboring:</p>
                <div className="bg-surface rounded-2xl p-5 flex items-center justify-center gap-4 border border-white/10">
                  <span className="text-3xl font-bold tracking-[0.4em] font-mono text-white">{createdRoom}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-2.5 bg-surface-lighter hover:bg-primary/30 rounded-xl transition-colors cursor-pointer"
                    title="Nusxalash"
                  >
                    <Copy size={20} className={copied ? 'text-success' : 'text-gray-400'} />
                  </button>
                </div>
                {copied && <p className="text-success text-sm mt-2">✓ Nusxalandi!</p>}
              </div>
              
              <button
                onClick={handleStartCall}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-lg shadow-lg shadow-primary/25 cursor-pointer pulse-ring"
              >
                <ArrowRight size={22} />
                Suhbatni boshlash
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-xl text-center text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          End-to-end shifrlangan · Xavfsiz ulanish
        </p>
      </div>
    </div>
  );
};

export default Lobby;
