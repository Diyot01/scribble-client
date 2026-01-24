import { useRef, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate, Routes, Route } from "react-router-dom";
import "./App.css";

const socket = io("https://scribble-server-3kgc.onrender.com", {
  transports: ["websocket"]
});

function Game() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState(false);
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState(roomId || "");
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [guess, setGuess] = useState("");
  const [word, setWord] = useState("");
  const [drawer, setDrawer] = useState("");
  const [time, setTime] = useState(60);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);

  const isDrawer = socket.id === drawer;

  const drawLine = useCallback((x0, y0, x1, y1, emit, c = color, s = size) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.strokeStyle = c;
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    if (emit) socket.emit("draw", { room, x0, y0, x1, y1, color, size });
  }, [color, size, room]);

  useEffect(() => {
    if (!joined) return;

    const canvas = canvasRef.current;
    canvas.width = 900;
    canvas.height = 500;
    ctxRef.current = canvas.getContext("2d");

    socket.on("draw", d => drawLine(d.x0, d.y0, d.x1, d.y1, false, d.color, d.size));
    socket.on("players", setPlayers);
    socket.on("message", m => setMessages(prev => [...prev, m]));
    socket.on("drawer", setDrawer);
    socket.on("word", setWord);
    socket.on("time", setTime);

    socket.on("newRound", () => {
      ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
      setMessages([]);
      setWord("");
    });

    return () => socket.off();
  }, [joined, drawLine]);

  const joinRoom = () => {
    if (!name || !room) return;
    socket.emit("joinRoom", { name, room });
    setJoined(true);
    navigate(`/room/${room}`);
  };

  const startDrawing = e => {
    if (!isDrawer) return;
    setDrawing(true);
    ctxRef.current.lastX = e.nativeEvent.offsetX;
    ctxRef.current.lastY = e.nativeEvent.offsetY;
  };

  const draw = e => {
    if (!drawing || !isDrawer) return;
    const { offsetX, offsetY } = e.nativeEvent;
    drawLine(ctxRef.current.lastX, ctxRef.current.lastY, offsetX, offsetY, true);
    ctxRef.current.lastX = offsetX;
    ctxRef.current.lastY = offsetY;
  };

  const sendGuess = () => {
    if (!guess) return;
    socket.emit("guess", guess);
    setGuess("");
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-card glass">
          <div className="join-title">🎨 Draw & Guess</div>
          <input className="input" placeholder="Name" onChange={e => setName(e.target.value)} />
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="Room Code" />
          <button className="btn" onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout">

      <div className="left-panel glass">
        <h3>{isDrawer ? `Draw: ${word}` : "Guess the word"} | ⏱ {time}s</h3>

        {isDrawer && (
          <div className="toolbar">
            🎨 <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            🖌 <input type="range" min="2" max="12" value={size} onChange={e => setSize(e.target.value)} />
          </div>
        )}
      </div>

      <div className="center-panel">
        <div className="canvas-frame">
          <canvas
            ref={canvasRef}
            className="canvas"
            onMouseDown={startDrawing}
            onMouseUp={() => setDrawing(false)}
            onMouseMove={draw}
            onMouseLeave={() => setDrawing(false)}
          />
        </div>
      </div>

      <div className="right-panel glass">
        <div className="card">
          <h3>Chat</h3>
          <div className="chat-box">
            {messages.map((m, i) => (
              <div key={i} className="chat-bubble">
                <b>{m.name}</b>
                <span>{m.text}</span>
              </div>
            ))}
          </div>

          {!isDrawer && (
            <>
              <input className="input" value={guess} onChange={e => setGuess(e.target.value)} />
              <button className="btn" onClick={sendGuess}>Send</button>
            </>
          )}
        </div>

        <div className="card">
          <h3>Players</h3>
          {players.sort((a,b)=>b.score-a.score).map(p => (
            <div key={p.id} className={`leaderboard-player ${p.id === drawer ? "drawer-active" : ""}`}>
              <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${p.name}`} alt="" />
              <div style={{ flex: 1 }}>
                <b>{p.name}</b>
                <div style={{ fontSize: "12px", opacity: 0.7 }}>{p.score} pts</div>
              </div>
              {p.id === drawer && <span className="turn-badge">DRAWING</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
      <Route path="/room/:roomId" element={<Game />} />
    </Routes>
  );
}
