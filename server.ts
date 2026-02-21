import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Active squads state
  const squads: any = {};
  const users: any = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_lobby", (userData) => {
      users[socket.id] = { ...userData, id: socket.id };
      io.emit("active_users", Object.values(users));
    });

    socket.on("create_squad", (squadName) => {
      const squadId = `squad_${Date.now()}`;
      squads[squadId] = {
        id: squadId,
        name: squadName,
        members: [users[socket.id]],
        leader: socket.id
      };
      socket.join(squadId);
      io.emit("active_squads", Object.values(squads));
    });

    socket.on("join_squad", (squadId) => {
      if (squads[squadId]) {
        squads[squadId].members.push(users[socket.id]);
        socket.join(squadId);
        io.emit("active_squads", Object.values(squads));
      }
    });

    socket.on("disconnect", () => {
      delete users[socket.id];
      // Clean up squads
      Object.keys(squads).forEach(id => {
        squads[id].members = squads[id].members.filter((m: any) => m.id !== socket.id);
        if (squads[id].members.length === 0) delete squads[id];
      });
      io.emit("active_users", Object.values(users));
      io.emit("active_squads", Object.values(squads));
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
