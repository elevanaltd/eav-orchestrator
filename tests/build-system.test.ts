// Context7: consulted for vitest
// Context7: consulted for fs
// Context7: consulted for path
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Build System Requirements', () => {
  const projectRoot = process.cwd();
  const indexHtmlPath = join(projectRoot, 'index.html');

  describe('index.html file', () => {
    it('should exist in the project root', () => {
      expect(existsSync(indexHtmlPath)).toBe(true);
    });

    it('should have proper DOCTYPE declaration', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
    });

    it('should have html lang attribute', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      expect(content).toContain('<html lang="en">');
    });

    it('should include proper meta tags for charset and viewport', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      expect(content).toContain('<meta charset="UTF-8">');
      expect(content).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    });

    it('should have a title element', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      expect(content).toContain('<title>');
      expect(content).toContain('</title>');
    });

    it('should contain a root div with id="root"', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      expect(content).toContain('<div id="root">');
    });

    it('should reference /src/main.tsx as the entry point script', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      expect(content).toContain('<script type="module" src="/src/main.tsx">');
    });

    it('should be valid HTML structure with proper nesting', () => {
      const content = readFileSync(indexHtmlPath, 'utf-8');
      
      // Check basic HTML structure
      expect(content).toMatch(/<html[^>]*>[\s\S]*<\/html>/);
      expect(content).toMatch(/<head>[\s\S]*<\/head>/);
      expect(content).toMatch(/<body>[\s\S]*<\/body>/);
      
      // Ensure root div is inside body
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/);
      expect(bodyMatch).toBeTruthy();
      if (bodyMatch) {
        expect(bodyMatch[1]).toContain('<div id="root">');
      }
    });
  });
});