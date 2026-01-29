import { useRef, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import "./App.css";

const socket = io("https://scribble-server-3kgc.onrender.com", {
  transports: ["websocket"]
});

function Game() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [room, setRoom] = useState(roomId || "");

  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [guess, setGuess] = useState("");

  const [wor, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [drawer, setDrawer] = useState("");
  const [time, setTime] = useState(60);

  const [drawing, setDrawing] = useState(false);
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
    ctxRef.current.lineCap = "round";

    socket.on("draw", d => drawLine(d.x0, d.y0, d.x1, d.y1, false, d.color, d.size));
    socket.on("players", setPlayers);
    socketd.on("message", msg => setMessages(m => [...m, msg]));
    socket.on("drawer", setDrawer);
    socket.on("word", setWord);
    socket.on("hint", setHint);
    socket.on("time", setTime);
    socket.on("newRound", () => ctxRef.current.clearRect(0,0,900,500));

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
    <div className="login-body">
      <div className="login-bg">

        <img src="/logo.png" className="login-logo" alt="Draw n Guess" />

        <div className="login-card glass">
          <h2>Login Page</h2>

          <div className="input-box">
            <span>👤</span>
            <input
              placeholder="Enter your username..."
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="input-box">
            <span>#</span>
            <input
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="Enter room code..."
            />
          </div>

          <button className="join-btn" onClick={joinRoom}>
            Join Room
          </button>

          <p className="login-hint">
            Enter a username and room code to join the game!
          </p>
        </div>
      </div>
    </div>
  );
}


  return (
    <div className="game-layout">

      {/* LEFT PANEL */}
      <div className="left-panel glass">
        <h3>⏱ {time}s</h3>
        <h3>{isDrawer ? `Draw: ${word}` : hint}</h3>

        <div className="players">
          {players.map(p => (
            <div key={p.id} className={`leaderboard-player ${p.id === drawer ? "drawer-active" : ""}`}>
              <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${p.name}`} alt="" />
              <div>
                <b>{p.name}</b>
                <div>{p.score} pts</div>
              </div>
              {p.id === drawer && <span className="turn-badge">DRAWING</span>}
            </div>
          ))}
        </div>
      </div>

      {/* CENTER */}
      <div className="center-panel">
        {isDrawer && (
          <div className="toolbar glass">
            🎨 <input type="color" value={color} onChange={e=>setColor(e.target.value)} />
            🖌 <input type="range" min="2" max="12" value={size} onChange={e=>setSize(e.target.value)} />
          </div>
        )}

        <div className="canvas-frame glass">
          <canvas
            ref={canvasRef}
            className="canvas"
            onMouseDown={startDrawing}
            onMouseUp={()=>setDrawing(false)}
            onMouseMove={draw}
          />
        </div>
      </div>

      {/* RIGHT */}
      <div className="right-panel glass">
        <div className="card">
          <h3>Chat</h3>
          <div className="chat-box">
            {messages.map((m,i)=>(
              <div key={i} className="chat-bubble">
                <b>{m.name}</b>
                <span>{m.text}</span>
              </div>
            ))}
          </div>

          {!isDrawer && (
            <>
              <input className="input" value={guess} onChange={e=>setGuess(e.target.value)} />
              <button className="btn" onClick={sendGuess}>Send</button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<Game/>}/>
      <Route path="/room/:roomId" element={<Game/>}/>
    </Routes>
  );
}
