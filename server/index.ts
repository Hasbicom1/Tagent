import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { wsManager } from "./websocket";
import { initializeQueue, closeQueue } from "./queue";

const app = express();
// Configure trust proxy first - BEFORE any middleware that needs it
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Log only basic request info - never sensitive response data
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize the task queue system first
    log('🚀 Initializing task queue system...');
    await initializeQueue();
    log('✅ Task queue system initialized');

    // Set up Express routes and get HTTP server instance
    const server = await registerRoutes(app);

    // Initialize WebSocket server with the HTTP server
    log('🔌 Initializing WebSocket server...');
    await wsManager.initialize(server);
    log('✅ WebSocket server initialized');

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`🌐 Server running on port ${port}`);
      log(`🔗 WebSocket available at ws://localhost:${port}/ws`);
      log(`📊 Queue stats: ${JSON.stringify(wsManager.getStats())}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      log(`\n🔄 ${signal} received. Starting graceful shutdown...`);
      
      try {
        // Close WebSocket connections
        await wsManager.shutdown();
        log('✅ WebSocket server closed');
        
        // Close task queue
        await closeQueue();
        log('✅ Task queue closed');
        
        // Close HTTP server
        server.close(() => {
          log('✅ HTTP server closed');
          process.exit(0);
        });
      } catch (error) {
        log('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts

  } catch (error) {
    log('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
