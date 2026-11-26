import "dotenv/config";
import http from "http";
import path from "path";
import express from "express";
import next from "next";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./src/lib/auth";
import usersRouter from "./src/server/routes/users";
import conversationsRouter from "./src/server/routes/conversations";
import uploadRouter from "./src/server/routes/upload";
import storiesRouter from "./src/server/routes/stories";
import { initSocketServer } from "./src/server/socket";

const dev = process.env.NODE_ENV !== "production" && !process.argv.includes("--prod");
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function bootstrap() {
  await app.prepare();

  const expressApp = express();
  const httpServer = http.createServer(expressApp);

  // Initialize Socket.io on the same HTTP server
  initSocketServer(httpServer);

  // Serve uploaded images, files, and voice notes directly
  expressApp.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Mount Better Auth handler in Express (must come before express.json)
  expressApp.all("/api/auth/{*splat}", toNodeHandler(auth));

  // Parse JSON only for Express API routes
  expressApp.use("/api/users", express.json(), usersRouter);
  expressApp.use("/api/conversations", express.json(), conversationsRouter);
  expressApp.use("/api/stories", express.json(), storiesRouter);
  expressApp.use("/api/upload", uploadRouter);

  // Health check
  expressApp.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "japchat" });
  });

  // Pass everything else (pages, static assets, /api/auth/*) to Next.js
  expressApp.all("/{*all}", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> JapChat server ready on http://${hostname}:${port} (dev=${dev})`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
