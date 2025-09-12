// Context7: consulted for vitest - testing framework already in use throughout project
// Context7: consulted for fs - Node.js built-in filesystem module, no external library needed
// Context7: consulted for path - Node.js built-in path module, no external library needed

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Repomix Configuration Files', () => {
  describe('Minimal Context Configuration', () => {
    const configPath = path.join(process.cwd(), 'repomix.minimal.json');
    let config: any;

    beforeAll(() => {
      // Config will be created after this test fails
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
      }
    });

    it('should exist and be valid JSON', () => {
      expect(fs.existsSync(configPath)).toBe(true);
      expect(() => {
        const content = fs.readFileSync(configPath, 'utf-8');
        JSON.parse(content);
      }).not.toThrow();
    });

    it('should include only essential files for session initialization', () => {
      expect(config).toBeDefined();
      expect(config.include).toBeDefined();
      expect(Array.isArray(config.include)).toBe(true);
      
      // Should include core files but be minimal
      expect(config.include).toContain('CLAUDE.md');
      expect(config.include).toContain('README.md');
      expect(config.include).toContain('package.json');
      
      // Should NOT include all source files (using patterns)
      expect(config.include.some((p: string) => p === 'src/**/*.ts')).toBe(false);
      
      // Should be a small, targeted list
      expect(config.include.length).toBeLessThanOrEqual(15);
    });

    it('should exclude test files and heavy documentation', () => {
      expect(config.ignore).toBeDefined();
      expect(config.ignore.customPatterns).toBeDefined();
      
      // Should exclude tests
      expect(config.ignore.customPatterns).toContain('tests/**');
      expect(config.ignore.customPatterns).toContain('**/*.test.ts');
      
      // Should exclude verbose docs
      expect(config.ignore.customPatterns.some((p: string) => 
        p.includes('docs/2') || p.includes('docs/1[1-9]')
      )).toBe(true);
    });

    it('should output to coordination context directory', () => {
      expect(config.output).toBeDefined();
      expect(config.output.filePath).toMatch(/\.coord\/context/);
      expect(config.output.filePath).toContain('minimal-context');
    });

    it('should use XML format for AI parsing', () => {
      expect(config.output.style).toBe('xml');
    });

    it('should remove comments and empty lines to reduce tokens', () => {
      expect(config.output.removeComments).toBe(true);
      expect(config.output.removeEmptyLines).toBe(true);
    });
  });

  describe('Comprehensive Context Configuration', () => {
    const configPath = path.join(process.cwd(), 'repomix.comprehensive.json');
    let config: any;

    beforeAll(() => {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(configContent);
      }
    });

    it('should exist and be valid JSON', () => {
      expect(fs.existsSync(configPath)).toBe(true);
      expect(() => {
        const content = fs.readFileSync(configPath, 'utf-8');
        JSON.parse(content);
      }).not.toThrow();
    });

    it('should include all source code and documentation', () => {
      expect(config).toBeDefined();
      expect(config.include).toBeDefined();
      
      // Should include broad patterns for comprehensive coverage
      const patterns = config.include as string[];
      expect(patterns.some((p: string) => p.includes('src/**'))).toBe(true);
      expect(patterns.some((p: string) => p.includes('docs/**'))).toBe(true);
    });

    it('should exclude only truly unnecessary files', () => {
      expect(config.ignore.customPatterns).toBeDefined();
      
      // Should still exclude node_modules, coverage, etc.
      const excludePatterns = config.ignore.customPatterns as string[];
      
      // But should NOT exclude tests (they're part of comprehensive context)
      expect(excludePatterns).not.toContain('tests/**');
    });

    it('should output to coordination context directory', () => {
      expect(config.output.filePath).toMatch(/\.coord\/context/);
      expect(config.output.filePath).toContain('comprehensive-context');
    });
  });

  describe('Session Context Configuration', () => {
    const configPath = path.join(process.cwd(), 'repomix.session.json');
    
    it('should exist for quick session initialization', () => {
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should be extremely minimal (< 5K tokens target)', () => {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // Should only include absolute essentials
      expect(config.include.length).toBeLessThanOrEqual(5);
      expect(config.include).toContain('CLAUDE.md');
      expect(config.include).toContain('package.json');
    });
  });
});