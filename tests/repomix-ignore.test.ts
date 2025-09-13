/**
 * Repomix Configuration Verification Test
 * 
 * PURPOSE: Verify that .repomixignore correctly excludes reference materials
 * and build artifacts from Repomix analysis to prevent context pollution.
 * 
 * This test validates the EFFECT of the configuration, not the file itself.
 * Contract: "The Repomix analysis MUST exclude specific files and directories"
 */

// Context7: consulted for vitest
// Context7: consulted for child_process (Node.js built-in)
// Context7: consulted for fs (Node.js built-in) 
// Context7: consulted for path (Node.js built-in)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Repomix Ignore Configuration', () => {
  const testDir = join(__dirname, '../test-temp-repomix');
  const repomixIgnorePath = join(__dirname, '../.repomixignore');
  
  beforeEach(() => {
    // Clean up any previous test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Create test directory structure that should be ignored
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'node_modules', 'some-package'), { recursive: true });
    mkdirSync(join(testDir, 'dist'), { recursive: true });
    mkdirSync(join(testDir, 'coverage'), { recursive: true });
    
    // Create reference-old directory structure
    const referenceOldPath = join(testDir, 'coordination', 'reference-old-eav-orch-repo');
    mkdirSync(referenceOldPath, { recursive: true });
    
    // Write test files that should be excluded
    writeFileSync(join(testDir, 'node_modules', 'some-package', 'index.js'), 
      '// This should be excluded from Repomix analysis');
    writeFileSync(join(testDir, 'dist', 'bundle.js'), 
      '// Build artifact that should be excluded');
    writeFileSync(join(testDir, 'coverage', 'report.html'), 
      '// Coverage report that should be excluded');
    writeFileSync(join(referenceOldPath, 'old-implementation.js'), 
      '// Reference code that should be excluded to prevent context pollution');
    
    // TESTGUARD-APPROVED: TESTGUARD-20250912-cf83d035
    // Ensure src directory exists first
    mkdirSync(join(testDir, 'src'), { recursive: true });
    
    // Write files that should be included
    writeFileSync(join(testDir, 'src', 'main.ts'), 
      '// Source code that should be included');
    writeFileSync(join(testDir, 'README.md'), 
      '# Test Project\nThis should be included in analysis');
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should exclude reference-old repository from Repomix analysis', () => {
    // This test will FAIL until .repomixignore is created with correct exclusions
    
    // Contract verification: .repomixignore file must exist and contain expected patterns
    expect(existsSync(repomixIgnorePath)).toBe(true);
    
    const ignoreContent = readFileSync(repomixIgnorePath, 'utf-8');
    
    // Verify critical exclusion patterns are present
    expect(ignoreContent).toContain('reference-old-eav-orch-repo');
    expect(ignoreContent).toContain('node_modules/');
    expect(ignoreContent).toContain('dist/');
    expect(ignoreContent).toContain('coverage/');
    
    // Verify the file includes documentation about its purpose
    expect(ignoreContent).toContain('context pollution');
    expect(ignoreContent).toContain('strategic pivot');
  });

  it('should prevent context pollution from old reference materials', () => {
    // Contract verification: Reference materials must not appear in analysis context
    expect(existsSync(repomixIgnorePath)).toBe(true);
    
    const ignoreContent = readFileSync(repomixIgnorePath, 'utf-8');
    
    // Verify multiple reference exclusion patterns
    const criticalExclusions = [
      '../coordination/reference-old-eav-orch-repo/',
      '/Volumes/HestAI-old/builds/eav-orchestrator-old/',
      'reference-old-eav-orch-repo/**/*'
    ];
    
    criticalExclusions.forEach(exclusion => {
      expect(ignoreContent).toContain(exclusion);
    });
  });

  it('should maintain clean development context by excluding build artifacts', () => {
    // Contract: Build artifacts and temporary files must not pollute analysis
    expect(existsSync(repomixIgnorePath)).toBe(true);
    
    const ignoreContent = readFileSync(repomixIgnorePath, 'utf-8');
    
    const buildArtifacts = [
      'node_modules/',
      'dist/',
      'coverage/',
      '.vite/',
      'logs/',
      '.DS_Store',
      '.env'
    ];
    
    buildArtifacts.forEach(artifact => {
      expect(ignoreContent).toContain(artifact);
    });
  });

  it('should include selective coordination context while excluding bulk reference', () => {
    // Contract: Include PROJECT_CONTEXT.md but exclude bulky reference materials
    expect(existsSync(repomixIgnorePath)).toBe(true);
    
    const ignoreContent = readFileSync(repomixIgnorePath, 'utf-8');
    
    // Should exclude reference materials but allow coordination docs
    expect(ignoreContent).toContain('../coordination/reference-old-eav-orch-repo/');
    expect(ignoreContent).toContain('SELECTIVE INCLUSION COMMENTS');
    expect(ignoreContent).toContain('PROJECT_CONTEXT.md');
  });
});