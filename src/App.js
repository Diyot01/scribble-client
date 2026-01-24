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

  // 🔊 Sounds
  const drawSound = useRef(new Audio("/sounds/draw.mp3"));
  const sendSound = useRef(new Audio("/sounds/send.mp3"));
  const winSound = useRef(new Audio("/sounds/win.mp3"));

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
  const [hint, setHint] = useState("");

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);

  const [gameOver, setGameOver] = useState(false);
  const [finalPlayers, setFinalPlayers] = useState([]);

  const [typingUser, setTypingUser] = useState("");
  const [role, setRole] = useState("player");

  const isDrawer = socket.id === drawer;

  const drawLine = useCallback((x0, y0, x1, y1, emit, drawColor = color, drawSize = size) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawSize;
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
    socket.on("message", msg => setMessages(m => [...m, msg]));
    socket.on("drawer", setDrawer);
    socket.on("word", setWord);
    socket.on("hint", setHint);
    socket.on("time", setTime);
    socket.on("role", setRole);

    socket.on("typing", user => {
      setTypingUser(user);
      setTimeout(() => setTypingUser(""), 1500);
    });

    socket.on("gameOver", data => {
      winSound.current.play();
      setFinalPlayers(data.sort((a, b) => b.score - a.score));
      setGameOver(true);
    });

    socket.on("newRound", () => {
      ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
      setMessages([]);
      setWord("");
      setHint("");
    });

    return () => socket.off();
  }, [joined, drawLine]);

  const joinRoom = () => {
    socket.emit("joinRoom", { name, room });
    setJoined(true);
    navigate(`/room/${room}`);
  };

  const startDrawing = e => {
    if (!isDrawer) return;
    drawSound.current.play();
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
    if (!guess || role === "spectator") return;
    sendSound.current.play();
    socket.emit("guess", guess);
    setGuess("");
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-card glass">
          <input className="input" placeholder="Name" onChange={e => setName(e.target.value)} />
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="Room" />
          <button className="btn" onClick={joinRoom}>Join</button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout">
      <div className="left-panel glass">
        <h3>{isDrawer ? `Draw: ${word}` : `Hint: ${hint}`} ⏱ {time}s</h3>

        {isDrawer && (
          <div className="toolbar">
            🎨 <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            🖌 <input type="range" min="2" max="12" value={size} onChange={e => setSize(e.target.value)} />
          </div>
        )}

        <div className="players">
          {players.map(p => <div key={p.id}>{p.name} — {p.score}</div>)}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={() => setDrawing(false)}
      />

      <div className="right-panel glass">
        {messages.map((m,i)=><div key={i}>{m.name}: {m.text}</div>)}
        <input value={guess} onChange={e=>setGuess(e.target.value)} />
        <button onClick={sendGuess}>Send</button>
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
