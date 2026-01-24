import { useRef, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate, Routes, Route } from "react-router-dom";

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

  // 🏆 Winner screen
  const [gameOver, setGameOver] = useState(false);
  const [finalPlayers, setFinalPlayers] = useState([]);

  const isDrawer = socket.id === drawer;

  // 🧠 FIXED: drawLine must be stable
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

  // 🏆 WINNER SCREEN
  if (gameOver) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h1>🏆 Game Over</h1>
        <h2>Winner: {finalPlayers[0]?.name}</h2>

        <h3>Final Scores</h3>
        {finalPlayers.map((p, i) => (
          <div key={p.id}>
            {i + 1}. {p.name} — {p.score} pts
          </div>
        ))}

        <button onClick={() => window.location.reload()}>Play Again</button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h1>Join Scribble</h1>
        <input placeholder="Name" onChange={e => setName(e.target.value)} />
        <br /><br />
        <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Room" />
        <br /><br />
        <button onClick={joinRoom}>Join</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex" }}>
      <div>
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
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onMouseLeave={stopDrawing}
          style={{ border: "3px solid black", cursor: isDrawer ? "crosshair" : "not-allowed" }}
        />
      </div>

      <div style={{ marginLeft: "20px", width: "300px" }}>
        <h3>Chat</h3>
        <div style={{ height: "300px", overflowY: "scroll", border: "1px solid black" }}>
          {messages.map((m, i) => (
            <div key={i}><b>{m.name}:</b> {m.text}</div>
          ))}
        </div>

        {!isDrawer && (
          <>
            <input value={guess} onChange={e => setGuess(e.target.value)} placeholder="Your guess" />
            <button onClick={sendGuess}>Send</button>
          </>
        )}

        <h4>Leaderboard</h4>
        {players.sort((a, b) => b.score - a.score).map(p => (
          <div key={p.id}>
            {p.id === drawer ? "✏️ " : "👤 "}
            {p.name} — {p.score} pts
          </div>
        ))}
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
