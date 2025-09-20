// Test Methodology Guardian: consulted for configuration validation approach
// Approved: contract-driven validation for configuration files
// Context7: consulted for fs
// Context7: consulted for path

import * as fs from 'fs';
import * as path from 'path';

describe('Build Configuration Validation', () => {
  describe('TypeScript Configuration', () => {
    const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    let tsConfig: any;

    beforeAll(() => {
      // Contract: tsconfig.json must exist and be valid JSON
      expect(fs.existsSync(tsConfigPath)).toBe(true);
      const tsConfigContent = fs.readFileSync(tsConfigPath, 'utf-8');
      expect(() => {
        tsConfig = JSON.parse(tsConfigContent);
      }).not.toThrow();
    });

    it('should enforce strict TypeScript compilation', () => {
      // Contract: Strict mode required for production code quality
      expect(tsConfig.compilerOptions.strict).toBe(true);
      expect(tsConfig.compilerOptions.noUnusedLocals).toBe(true);
      expect(tsConfig.compilerOptions.noUnusedParameters).toBe(true);
      expect(tsConfig.compilerOptions.noFallthroughCasesInSwitch).toBe(true);
    });

    it('should configure modern ES target and modules', () => {
      // Contract: Modern JavaScript target required
      expect(tsConfig.compilerOptions.target).toBe('ESNext');
      expect(tsConfig.compilerOptions.module).toBe('ESNext');
      expect(tsConfig.compilerOptions.lib).toContain('ESNext');
      expect(tsConfig.compilerOptions.lib).toContain('DOM');
    });

    it('should configure React JSX transformation', () => {
      // Contract: React 19 JSX runtime required
      expect(tsConfig.compilerOptions.jsx).toBe('react-jsx');
    });

    it('should configure path aliases', () => {
      // Contract: @ alias must point to src directory
      expect(tsConfig.compilerOptions.baseUrl).toBe('.');
      expect(tsConfig.compilerOptions.paths).toHaveProperty('@/*');
      expect(tsConfig.compilerOptions.paths['@/*']).toEqual(['src/*']);
    });

    it('should include source and config files', () => {
      // Contract: Must include src directory and config files
      expect(tsConfig.include).toContain('src');
      expect(tsConfig.include).toContain('vite.config.ts');
    });

    it('should reference node configuration', () => {
      // Contract: Node configuration separation required
      expect(tsConfig.references).toEqual([{ path: './tsconfig.node.json' }]);
    });
  });

  describe('ESLint Configuration', () => {
    it('should have ESLint configuration file', () => {
      // Contract: ESLint config must exist
      const eslintConfigPath = path.join(process.cwd(), '.eslintrc.cjs');
      expect(fs.existsSync(eslintConfigPath)).toBe(true);
    });
  });

  describe('Package Scripts', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    let packageJson: any;

    beforeAll(() => {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageJsonContent);
    });

    it('should have essential quality gate scripts', () => {
      // Contract: Quality gates must be operational
      expect(packageJson.scripts).toHaveProperty('lint');
      expect(packageJson.scripts).toHaveProperty('typecheck');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('validate');
    });

    it('should have proper module type for ESM', () => {
      // Contract: Module type must be "module" for ESM project
      expect(packageJson.type).toBe('module');
    });
  });

  describe('Dependabot Configuration', () => {
    const dependabotConfigPath = path.join(process.cwd(), '.github', 'dependabot.yml');

    it('should exist for automated dependency management', () => {
      // Contract: Dependabot configuration must exist for security updates
      expect(fs.existsSync(dependabotConfigPath)).toBe(true);
    });

    it('should contain npm package ecosystem configuration', () => {
      // Contract: npm dependencies must be monitored for security updates
      if (fs.existsSync(dependabotConfigPath)) {
        const dependabotContent = fs.readFileSync(dependabotConfigPath, 'utf-8');
        expect(dependabotContent).toContain('package-ecosystem: "npm"');
        expect(dependabotContent).toContain('directory: "/"');
        expect(dependabotContent).toContain('schedule:');
      }
    });

    it('should limit open pull requests to prevent noise', () => {
      // Contract: Must limit concurrent PRs to maintain productivity
      if (fs.existsSync(dependabotConfigPath)) {
        const dependabotContent = fs.readFileSync(dependabotConfigPath, 'utf-8');
        expect(dependabotContent).toContain('open-pull-requests-limit');
      }
    });
  });
});