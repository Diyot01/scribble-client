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

  const [gameOver, setGameOver] = useState(false);
  const [finalPlayers, setFinalPlayers] = useState([]);

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

    if (emit) {
      socket.emit("draw", { room, x0, y0, x1, y1, color, size });
    }
  }, [color, size, room]);

  useEffect(() => {
    if (!joined) return;

    const canvas = canvasRef.current;
    canvas.width = 900;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctxRef.current = ctx;

    socket.on("draw", ({ x0, y0, x1, y1, color, size }) =>
      drawLine(x0, y0, x1, y1, false, color, size)
    );

    socket.on("players", setPlayers);
    socket.on("message", msg => setMessages(m => [...m, msg]));
    socket.on("drawer", setDrawer);
    socket.on("word", setWord);
    socket.on("time", setTime);

    socket.on("gameOver", (data) => {
      setFinalPlayers(data.sort((a, b) => b.score - a.score));
      setGameOver(true);
    });

    socket.on("newRound", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setMessages([]);
      setWord("");
    });

    return () => socket.off();
  }, [joined, drawLine]);

  const joinRoom = () => {
    if (!name || !room) return alert("Enter name and room");
    socket.emit("joinRoom", { name, room });
    setJoined(true);
    navigate(`/room/${room}`);
  };

  const startDrawing = (e) => {
    if (!isDrawer) return;
    setDrawing(true);
    const { offsetX, offsetY } = e.nativeEvent;
    ctxRef.current.lastX = offsetX;
    ctxRef.current.lastY = offsetY;
  };

  const stopDrawing = () => setDrawing(false);

  const draw = (e) => {
    if (!drawing || !isDrawer) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const { lastX, lastY } = ctxRef.current;
    drawLine(lastX, lastY, offsetX, offsetY, true);
    ctxRef.current.lastX = offsetX;
    ctxRef.current.lastY = offsetY;
  };

  const sendGuess = () => {
    if (!guess) return;
    socket.emit("guess", guess);
    setGuess("");
  };

  // 🏆 WINNER
  if (gameOver) {
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>🏆 Game Over</h1>
          <h2>Winner: {finalPlayers[0]?.name}</h2>
          {finalPlayers.map((p, i) => (
            <div key={p.id}>{i + 1}. {p.name} — {p.score} pts</div>
          ))}
          <button className="btn" onClick={() => window.location.reload()}>Play Again</button>
        </div>
      </div>
    );
  }

  // 🎨 JOIN
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>🎨 Scribble</h1>
          <input className="input" placeholder="Name" onChange={e => setName(e.target.value)} />
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="Room" />
          <button className="btn" onClick={joinRoom}>Join Game</button>
        </div>
      </div>
    );
  }

  // 🎮 GAME
  return (
    <div className="game-wrapper">
      <div className="left-panel">
        <h3>{isDrawer ? `Draw: ${word}` : "Guess the word..."} | ⏱ {time}s</h3>

        {isDrawer && (
          <div style={{ marginBottom: "10px" }}>
            🎨 <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            🖌 <input type="range" min="2" max="12" value={size} onChange={e => setSize(e.target.value)} />
            🧽 <button onClick={() => setColor("#ffffff")}>Eraser</button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="canvas"
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={stopDrawing}
        />
      </div>

      <div className="right-panel">
        <div className="card">
          <h3>Chat</h3>
          {messages.map((m, i) => (
            <div key={i}><b>{m.name}:</b> {m.text}</div>
          ))}
          {!isDrawer && (
            <>
              <input className="input" value={guess} onChange={e => setGuess(e.target.value)} placeholder="Your guess" />
              <button className="btn" onClick={sendGuess}>Send</button>
            </>
          )}
        </div>

        <div className="card">
          <h3>Leaderboard</h3>
          {players.sort((a, b) => b.score - a.score).map(p => (
            <div key={p.id}>
              {p.id === drawer ? "✏️ " : "👤 "}
              {p.name} — {p.score}
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
