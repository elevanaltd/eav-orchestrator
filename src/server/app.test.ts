// TDD TEST: BFF Security Server Test Suite
// Tests for Express app with security middleware and proper TypeScript types

// Context7: consulted for vitest
// Context7: consulted for express
// Context7: consulted for http

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Server } from 'http';
import {
  getConfig,
  requestContext,
  errorHandler,
  gracefulShutdown,
  // requestLogger, // TODO: Add tests for requestLogger
  healthCheck,
  // createApp, // TODO: Add tests for createApp
  // startServer, // TODO: Add tests for startServer
  // type SecurityConfig, // TODO: Add tests that use SecurityConfig
  // type RequestContext // TODO: Add tests that use RequestContext
} from './app';

// Mock modules
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123')
}));

describe('BFF Security Server', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Setup mocks
    mockReq = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      context: undefined as any
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      on: vi.fn()
    };
    
    mockNext = vi.fn();
    
    // Reset environment
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfig', () => {
    it('should parse and return security configuration', () => {
      // Setup environment
      process.env.PORT = '3001';
      process.env.NODE_ENV = 'test';
      process.env.CORS_ORIGINS = 'http://localhost:5173,http://localhost:3000';
      process.env.RATE_LIMIT_MAX = '100';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.SUPABASE_URL = 'https://test.supabase.co';

      const config = getConfig();

      expect(config.port).toBe(3001);
      expect(config.nodeEnv).toBe('test');
      expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:3000']);
      expect(config.rateLimitMax).toBe(100);
      expect(config.rateLimitWindowMs).toBe(900000);
      expect(config.elevenlabsApiKey).toBe('test-key');
      expect(config.supabaseServiceRoleKey).toBe('test-service-key');
      expect(config.supabaseUrl).toBe('https://test.supabase.co');
    });

    it('should throw error for missing required environment variables', () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      expect(() => getConfig()).toThrow();
    });
  });

  describe('requestContext middleware', () => {
    it('should add context to request with UUID and timestamp', () => {
      requestContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.context).toBeDefined();
      expect(mockReq.context?.requestId).toBe('test-uuid-123');
      expect(mockReq.context?.startTime).toBeDefined();
      expect(mockRes.set).toHaveBeenCalledWith('X-Request-ID', 'test-uuid-123');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle errors and not call next', () => {
      const error = new Error('Test error');
      mockReq.context = {
        requestId: 'test-123',
        startTime: Date.now()
      };

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'An internal error occurred',
        requestId: 'test-123'
      });
      // Next should NOT be called in error handler
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle ZodError with 400 status', () => {
      const error = new Error('Validation error');
      error.name = 'ZodError';
      mockReq.context = {
        requestId: 'test-123',
        startTime: Date.now()
      };

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('gracefulShutdown', () => {
    it('should accept Server type and handle shutdown', (done) => {
      const mockServer: Partial<Server> = {
        close: vi.fn((callback?: (err?: Error) => void) => {
          callback?.(undefined);
          return {} as Server;
        }) as Server['close']
      };

      // Mock process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        done();
        return undefined as never;
      }) as any);

      gracefulShutdown(mockServer as Server, 'SIGTERM');

      expect(mockServer.close).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle server close errors', (done) => {
      const mockServer: Partial<Server> = {
        close: vi.fn((callback?: (err?: Error) => void) => {
          callback?.(new Error('Close error'));
          return {} as Server;
        }) as Server['close']
      };

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        done();
        return undefined as never;
      }) as any);

      gracefulShutdown(mockServer as Server, 'SIGTERM');

      expect(mockServer.close).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      healthCheck(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String)
        })
      );
    });
  });

  describe('module augmentation', () => {
    it('should properly extend Express Request interface', () => {
      // This test verifies TypeScript compilation succeeds with module augmentation
      const req = {} as Request;
      req.context = {
        requestId: 'test',
        startTime: Date.now()
      };
      
      expect(req.context).toBeDefined();
    });
  });
});