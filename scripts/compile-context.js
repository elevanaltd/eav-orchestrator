#!/usr/bin/env node

// Critical-Engineer: consulted for build process and dependency management
// Platform-independent Node.js implementation to replace bash dependency
// Uses local repomix installation to ensure version consistency

// Context7: consulted for child_process
// Context7: consulted for fs  
// Context7: consulted for path
// Context7: consulted for url
import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, readdirSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = resolve(__dirname, '..');
const CONTEXT_DIR = join(PROJECT_ROOT, '.coord', 'context');
const TIMESTAMP = new Date().toISOString().replace(/[:T-]/g, '').slice(0, 13); // YYYYMMDD-HHMMSS
const CURRENT_BRANCH = getCurrentBranch();
const CURRENT_COMMIT = getCurrentCommit();

// Phase context filename
const CONTEXT_FILE = join(CONTEXT_DIR, `${TIMESTAMP}-${CURRENT_BRANCH}-phase-context.md`);

console.log('🔄 Compiling project context snapshot...');
console.log(`📁 Output: ${CONTEXT_FILE}`);
console.log(`🌿 Branch: ${CURRENT_BRANCH} (${CURRENT_COMMIT})`);

function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', { 
            encoding: 'utf8', 
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch {
        return 'no-git';
    }
}

function getCurrentCommit() {
    try {
        return execSync('git rev-parse --short HEAD', { 
            encoding: 'utf8', 
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch {
        return 'no-commit';
    }
}

// Ensure context directory exists
if (!existsSync(CONTEXT_DIR)) {
    mkdirSync(CONTEXT_DIR, { recursive: true });
}

// Create Repomix configuration
const repomixConfig = {
    include: [
        "**/*.ts",
        "**/*.tsx", 
        "**/*.js",
        "**/*.jsx",
        "**/*.json",
        "**/*.md",
        "**/*.yml",
        "**/*.yaml",
        "**/*.sh",
        "**/*.sql",
        "**/Dockerfile*",
        "**/.env.example"
    ],
    exclude: [
        "node_modules/**",
        "dist/**",
        "build/**",
        "coverage/**",
        ".git/**",
        "**/*.log",
        "**/.DS_Store",
        "**/package-lock.json",
        "**/yarn.lock",
        "**/*.tsbuildinfo"
    ],
    output: {
        filePath: CONTEXT_FILE,
        style: "markdown",
        headerText: [
            "# EAV Orchestrator Project Context Snapshot",
            "",
            `Generated: ${TIMESTAMP}`,
            `Branch: ${CURRENT_BRANCH}`,
            `Commit: ${CURRENT_COMMIT}`,
            "",
            "This snapshot captures the complete project state at a phase boundary for holistic orchestrator analysis.",
            ""
        ].join("\n"),
        instructionFilePath: "",
        removeComments: false,
        showLineNumbers: true,
        topFilesLength: 2000,
        outputJson: false
    },
    security: {
        enableSecurityCheck: true
    }
};

const tempConfigPath = join(CONTEXT_DIR, '.repomix-temp-config.json');

try {
    // Write temporary config
    writeFileSync(tempConfigPath, JSON.stringify(repomixConfig, null, 2));
    
    // Run repomix using local installation
    const repomixPath = join(PROJECT_ROOT, 'node_modules', '.bin', 'repomix');
    execSync(`"${repomixPath}" --config "${tempConfigPath}"`, { 
        cwd: PROJECT_ROOT,
        stdio: 'inherit'
    });
    
    // Clean up temp config
    unlinkSync(tempConfigPath);
    
    // Generate diff summary if previous snapshot exists
    const snapshots = getExistingSnapshots();
    const previousSnapshot = snapshots.find(s => !s.includes(TIMESTAMP));
    
    let diffContent = '';
    
    if (previousSnapshot && existsSync(previousSnapshot)) {
        diffContent += '\n## Changes Since Previous Snapshot\n\n';
        diffContent += `Previous snapshot: ${basename(previousSnapshot)}\n\n`;
        
        // Git changes summary
        if (CURRENT_BRANCH !== 'no-git') {
            const previousCommit = extractCommitFromSnapshot(previousSnapshot);
            if (previousCommit && previousCommit !== CURRENT_COMMIT) {
                diffContent += '### Git Changes\n\n';
                diffContent += '```bash\n';
                try {
                    const gitLog = execSync(`git log --oneline ${previousCommit}..HEAD`, {
                        encoding: 'utf8',
                        cwd: PROJECT_ROOT,
                        stdio: ['ignore', 'pipe', 'ignore']
                    }).trim();
                    diffContent += gitLog.split('\n').slice(0, 20).join('\n');
                } catch {
                    diffContent += 'Could not determine git changes';
                }
                diffContent += '\n```\n\n';
            }
        }
        
        // File count comparison
        const currentLines = getLineCount(CONTEXT_FILE);
        const previousLines = getLineCount(previousSnapshot);
        const lineDiff = currentLines - previousLines;
        
        diffContent += '### Snapshot Metrics\n';
        diffContent += `- Current snapshot: ${currentLines} lines\n`;
        diffContent += `- Previous snapshot: ${previousLines} lines\n`;
        diffContent += `- Difference: ${lineDiff} lines\n\n`;
        
        console.log('📊 Generated diff summary against previous snapshot');
    } else {
        diffContent += '\n## First Snapshot\n\n';
        diffContent += 'This is the first context snapshot for this project.\n\n';
        console.log('📍 First context snapshot generated');
    }
    
    // Add metadata footer
    diffContent += '\n---\n';
    diffContent += '*Generated by EAV Orchestrator context compilation system*\n';
    diffContent += '*For holistic orchestrator phase boundary analysis*\n';
    
    // Append diff content to the context file
    const { readFileSync } = await import('fs');
    const existingContent = readFileSync(CONTEXT_FILE, 'utf8');
    writeFileSync(CONTEXT_FILE, existingContent + diffContent);
    
    console.log('✅ Context snapshot compiled successfully');
    console.log(`📄 File: ${CONTEXT_FILE}`);
    console.log(`📏 Size: ${getLineCount(CONTEXT_FILE)} lines`);
    
    // Cleanup old snapshots (keep last 10)
    cleanupOldSnapshots();
    
    console.log('🧹 Cleaned up old snapshots (kept 10 most recent)');
    console.log(`📂 Context directory: ${CONTEXT_DIR}`);
    
} catch (error) {
    // Cleanup temp config on error
    if (existsSync(tempConfigPath)) {
        unlinkSync(tempConfigPath);
    }
    console.error('❌ Context compilation failed:', error.message);
    process.exit(1);
}

function getExistingSnapshots() {
    if (!existsSync(CONTEXT_DIR)) return [];
    
    return readdirSync(CONTEXT_DIR)
        .filter(file => file.endsWith('-phase-context.md'))
        .map(file => join(CONTEXT_DIR, file))
        .sort((a, b) => statSync(b).mtime - statSync(a).mtime);
}

function extractCommitFromSnapshot(snapshotPath) {
    try {
        const content = require('fs').readFileSync(snapshotPath, 'utf8');
        const match = content.match(/^Commit:\s*(.+)$/m);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

function getLineCount(filePath) {
    try {
        const content = require('fs').readFileSync(filePath, 'utf8');
        return content.split('\n').length;
    } catch {
        return 0;
    }
}

function cleanupOldSnapshots() {
    const snapshots = getExistingSnapshots();
    const toDelete = snapshots.slice(10); // Keep 10 most recent
    
    toDelete.forEach(snapshot => {
        try {
            unlinkSync(snapshot);
        } catch (error) {
            console.warn(`Warning: Could not delete old snapshot: ${snapshot}`);
        }
    });
}
