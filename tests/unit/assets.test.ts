// Context7: consulted for vitest
// Context7: consulted for fs
// Context7: consulted for path
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Asset Files', () => {
  test('index.css exists in src directory', () => {
    const cssPath = path.resolve(__dirname, '../../src/index.css');
    const fileExists = fs.existsSync(cssPath);
    expect(fileExists).toBe(true);
  });

  test('index.css is importable', () => {
    // This test verifies the file can be imported without error
    expect(() => {
      const cssPath = path.resolve(__dirname, '../../src/index.css');
      fs.readFileSync(cssPath, 'utf-8');
    }).not.toThrow();
  });

  test('index.css contains basic reset styles', () => {
    const cssPath = path.resolve(__dirname, '../../src/index.css');
    const content = fs.readFileSync(cssPath, 'utf-8');
    
    // Check for essential CSS reset patterns
    expect(content).toContain('*');
    expect(content).toContain('margin');
    expect(content).toContain('padding');
    expect(content).toContain('box-sizing');
  });
});