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
  const [role, setRole] = useState("player"); // player | spectator

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
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctxRef.current = ctx;

    socket.on("draw", d => drawLine(d.x0, d.y0, d.x1, d.y1, false, d.color, d.size));
    socket.on("players", setPlayers);
    socket.on("message", msg => setMessages(m => [...m, msg]));
    socket.on("drawer", setDrawer);
    socket.on("word", setWord);

    // ⏱ time + hint
    socket.on("time", data => {
      setTime(data.time);
      setHint(data.hint || "");
      if (data.hint && !isDrawer) setWord(data.hint);
    });

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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setMessages([]);
      setWord("");
      setHint("");
    });

    return () => socket.off();
  }, [joined, drawLine, isDrawer]);

  const joinRoom = () => {
    if (!name || !room) return alert("Enter name and room");
    socket.emit("joinRoom", { name, room });
    setJoined(true);
    navigate(`/room/${room}`);
  };

  const startDrawing = e => {
    if (!isDrawer) return;
    drawSound.current.play();
    setDrawing(true);
    const { offsetX, offsetY } = e.nativeEvent;
    ctxRef.current.lastX = offsetX;
    ctxRef.current.lastY = offsetY;
  };

  const draw = e => {
    if (!drawing || !isDrawer) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const { lastX, lastY } = ctxRef.current;
    drawLine(lastX, lastY, offsetX, offsetY, true);
    ctxRef.current.lastX = offsetX;
    ctxRef.current.lastY = offsetY;
  };

  const stopDrawing = () => setDrawing(false);

  const sendGuess = () => {
    if (!guess || role === "spectator") return;
    sendSound.current.play();
    socket.emit("guess", guess);
    setGuess("");
  };

  // 🏆 GAME OVER
  if (gameOver) {
    return (
      <div className="join-container">
        <div className="join-card glass">
          <h1>🏆 Game Over</h1>
          <h2>Winner: {finalPlayers[0]?.name}</h2>
          {finalPlayers.map((p, i) => <div key={p.id}>{i + 1}. {p.name} — {p.score}</div>)}
          <button className="btn" onClick={() => window.location.reload()}>Play Again</button>
        </div>
      </div>
    );
  }

  // 🎨 JOIN
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-card glass">
          <div className="join-title">🎨 Draw & Guess</div>
          <input className="input" placeholder="Username" onChange={e => setName(e.target.value)} />
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="Room Code" />
          <button className="btn" onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  // 🎮 GAME
  return (
    <div className="game-layout">
      <div className="left-panel glass">
        <h3>
          {isDrawer ? `Draw: ${word}` : `Guess: ${word || "?"}`}
          <br />
          ⏱ {time}s
        </h3>
      </div>

      <div className="center-panel glass">
        <div className="canvas-frame">
          <canvas
            ref={canvasRef}
            className="canvas"
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseMove={draw}
            onMouseLeave={stopDrawing}
          />
        </div>
      </div>

      <div className="right-panel glass">
        <div className="card">
          <h3>Chat {role === "spectator" && "👀 (Spectator)"}</h3>

          <div className="chat-box">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.name === name ? "my-msg" : ""}`}>
                <b>{m.name}</b>
                <span>{m.text}</span>
              </div>
            ))}
          </div>

          {typingUser && <div className="typing">{typingUser} is typing…</div>}

          {role !== "spectator" && !isDrawer && (
            <>
              <input
                className="input"
                value={guess}
                onChange={e => {
                  setGuess(e.target.value);
                  socket.emit("typing", name);
                }}
              />
              <button className="btn" onClick={sendGuess}>Send</button>
            </>
          )}
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
