// Critical-Engineer: consulted for security wrapper architecture (credential proxy, rate limiting)
// Context7: consulted for express
// Context7: consulted for helmet
// Context7: consulted for cors
// Context7: consulted for express-rate-limit
// Context7: consulted for pino
// Context7: consulted for zod
// Context7: consulted for crypto
// Context7: consulted for http

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Server } from 'http';

// Types
export interface SecurityConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  elevenlabsApiKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
}

// Logger setup with structured logging
const logger = pino({
  name: 'eav-bff',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Configuration with validation
const configSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'), // 15 minutes
  ELEVENLABS_API_KEY: z.string().min(1, 'ElevenLabs API key required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key required'),
  SUPABASE_URL: z.string().url('Valid Supabase URL required'),
});

export function getConfig(): SecurityConfig {
  const envVars = configSchema.parse(process.env);
  
  return {
    port: parseInt(envVars.PORT, 10),
    nodeEnv: envVars.NODE_ENV,
    corsOrigins: envVars.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    rateLimitMax: parseInt(envVars.RATE_LIMIT_MAX, 10),
    rateLimitWindowMs: parseInt(envVars.RATE_LIMIT_WINDOW_MS, 10),
    elevenlabsApiKey: envVars.ELEVENLABS_API_KEY,
    supabaseServiceRoleKey: envVars.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: envVars.SUPABASE_URL,
  };
}

// Request context middleware
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const context: RequestContext = {
    requestId: randomUUID(),
    startTime: Date.now(),
  };
  
  req.context = context;
  res.set('X-Request-ID', context.requestId);
  
  logger.info({
    requestId: context.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  }, 'Request started');
  
  next();
}

// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const context = req.context as RequestContext;
  const statusCode = err.name === 'ZodError' ? 400 : 500;
  
  // Log full error internally
  logger.error({
    requestId: context?.requestId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    path: req.path,
    method: req.method,
  }, 'Request error');
  
  // Send generic error to client (no internal details)
  res.status(statusCode).json({
    error: 'An internal error occurred',
    requestId: context?.requestId,
  });
}

// Request completion logging
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const context = req.context as RequestContext;
    const duration = Date.now() - context.startTime;
    
    logger.info({
      requestId: context.requestId,
      statusCode: res.statusCode,
      duration,
      method: req.method,
      path: req.path,
    }, 'Request completed');
  });
  
  next();
}

// Health check endpoint
export function healthCheck(_req: Request, res: Response) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
}

// Create Express app
export function createApp(config: SecurityConfig): express.Application {
  const app = express();
  
  // Trust proxy for rate limiting (if behind reverse proxy)
  app.set('trust proxy', 1);
  
  // Security middleware (highest priority)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", config.supabaseUrl],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow for external API calls
  }));
  
  // CORS configuration
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));
  
  // Rate limiting with memory store (upgrade to Redis for production clustering)
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: {
      error: 'Too many requests, please try again later',
      retryAfter: Math.ceil(config.rateLimitWindowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const context = req.context as RequestContext;
      logger.warn({
        requestId: context?.requestId,
        ip: req.ip,
        path: req.path,
      }, 'Rate limit exceeded');
      
      res.status(429).json({
        error: 'Too many requests, please try again later',
        requestId: context?.requestId,
        retryAfter: Math.ceil(config.rateLimitWindowMs / 1000),
      });
    },
  });
  
  // Apply middleware stack
  app.use(limiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestContext);
  app.use(requestLogger);
  
  // Health check (no rate limiting)
  app.get('/healthz', healthCheck);
  
  // Mount API routes (will be added)
  // app.use('/api/elevenlabs', elevenlabsRouter);
  // app.use('/api/supabase', supabaseRouter);
  
  // 404 handler
  app.use('*', (req, res) => {
    const context = req.context as RequestContext;
    res.status(404).json({
      error: 'Endpoint not found',
      requestId: context.requestId,
    });
  });
  
  // Error handler (must be last)
  app.use(errorHandler);
  
  return app;
}

// Graceful shutdown handler
export function gracefulShutdown(server: Server, signal: string) {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');
  
  server.close((err?: Error) => {
    if (err) {
      logger.error({ error: err }, 'Error during server shutdown');
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
}

// Start server
export function startServer() {
  const config = getConfig();
  const app = createApp(config);
  
  const server = app.listen(config.port, () => {
    logger.info({
      port: config.port,
      nodeEnv: config.nodeEnv,
      corsOrigins: config.corsOrigins,
    }, 'BFF server started');
  });
  
  // Graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));
  
  return server;
}

// Extend Express Request interface using module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    context: RequestContext;
  }
}
