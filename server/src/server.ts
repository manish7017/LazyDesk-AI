import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { getDatabase, closeDatabase, initializeSchema } from "./db/database.js";
import { aiRouter } from "./routes/ai.routes.js";
import { scanRouter } from "./routes/scan.routes.js";
import { organizeRouter } from "./routes/organize.routes.js";
import { duplicateRouter } from "./routes/duplicate.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { browseRouter } from "./routes/browse.routes.js";
import { demoRouter } from "./routes/demo.routes.js";

dotenv.config();

export function createApp(): express.Application {
  const app = express();

  // Initialize DB schema on startup
  const db = getDatabase();
  initializeSchema(db);

  // Security: CORS configured for local dev and client
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ],
      credentials: true,
    })
  );

  // Request limits
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Safe request logging (EXCLUDES file contents and request bodies)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    // Intentionally only log method and sanitized URL - never sensitive content
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "LazyDesk AI Local Engine",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  });

  // REST API Endpoints
  app.use("/api/ai", aiRouter);
  app.use("/api/scan", scanRouter);
  app.use("/api/scans", scanRouter);
  app.use("/api/organize", organizeRouter);
  app.use("/api/duplicates", duplicateRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/browse", browseRouter);
  app.use("/api/demo", demoRouter);

  // Serve static client assets in production if client/dist exists
  const clientDistPath = path.resolve(process.cwd(), "client", "dist");
  const fallbackClientDist = path.resolve(process.cwd(), "..", "client", "dist");

  const staticDir = fs.existsSync(clientDistPath)
    ? clientDistPath
    : fs.existsSync(fallbackClientDist)
    ? fallbackClientDist
    : null;

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // Catch-all 404 for unknown API routes
  app.all("/api/*", (req: Request, res: Response) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.path}`,
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[ServerError]", err?.message || err);
    res.status(err?.status || 500).json({
      error: err?.message || "Internal server error",
    });
  });

  return app;
}

// Start server when executed directly
if (process.env.NODE_ENV !== "test") {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3001;
  // Loopback interface binding (127.0.0.1) prevents external network exposure
  const HOST = process.env.HOST || "127.0.0.1";

  const server = app.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   📁  LazyDesk AI — Local-First File Organizer Server          ║
║   🔒  Bound safely to loopback: http://${HOST}:${PORT}          ║
║   🤖  Ollama integration active                                ║
║   ✨  Hacktoberfest 2026 Edition: Week 3 "Slow and Steady"     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down gracefully...");
    closeDatabase();
    server.close(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    closeDatabase();
    server.close(() => process.exit(0));
  });
}
