import React, { useState } from 'react';
import Lobby from './components/Lobby';
import VideoRoom from './components/VideoRoom';

function App() {
  const [roomId, setRoomId] = useState(null);
  const [isInCall, setIsInCall] = useState(false);

  const handleJoinRoom = (id) => {
    setRoomId(id);
    setIsInCall(true);
  };

  const handleLeaveCall = () => {
    setRoomId(null);
    setIsInCall(false);
  };

  return (
    <div className="min-h-screen bg-surface">
      {!isInCall ? (
        <Lobby onJoinRoom={handleJoinRoom} />
      ) : (
        <VideoRoom roomId={roomId} onLeave={handleLeaveCall} />
      )}
    </div>
  );
}

export default App;
