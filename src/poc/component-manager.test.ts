/**
 * Component Manager Tests - TDD Red State
 *
 * Testing the component extraction and management for single editor architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentManager, DownstreamSyncManager } from './component-manager';
import { Editor } from '@tiptap/core';

describe('ComponentManager', () => {
  let mockEditor: any;
  let componentManager: ComponentManager;

  beforeEach(() => {
    // Create a mock editor with test document structure
    mockEditor = {
      state: {
        doc: {
          nodeSize: 100,
          forEach: vi.fn((callback) => {
            // Simulate a document with component dividers
            const nodes = [
              { type: { name: 'heading' }, textContent: 'MVHR System Guide', nodeSize: 10 },
              { type: { name: 'paragraph' }, textContent: 'Introduction text', nodeSize: 10 },
              {
                type: { name: 'componentDivider' },
                attrs: { componentNumber: 2, componentType: 'action', approvalStatus: 'draft' },
                nodeSize: 1
              },
              { type: { name: 'paragraph' }, textContent: 'Component 2 content', nodeSize: 10 },
              {
                type: { name: 'componentDivider' },
                attrs: { componentNumber: 3, componentType: 'maintenance', approvalStatus: 'review' },
                nodeSize: 1
              },
              { type: { name: 'paragraph' }, textContent: 'Component 3 content', nodeSize: 10 }
            ];

            let offset = 0;
            nodes.forEach(node => {
              callback(node, offset);
              offset += node.nodeSize;
            });
          })
        }
      }
    };

    componentManager = new ComponentManager(mockEditor as Editor);
  });

  describe('extractComponents', () => {
    it('should extract components from the editor document', () => {
      const components = componentManager.extractComponents();

      expect(components).toHaveLength(3);
      expect(components[0].plainText).toContain('Introduction text');
      expect(components[1].type).toBe('action');
      expect(components[2].type).toBe('maintenance');
    });

    it('should calculate word counts correctly', () => {
      const components = componentManager.extractComponents();

      expect(components[0].wordCount).toBe(2); // "Introduction text"
      expect(components[1].wordCount).toBe(3); // "Component 2 content"
      expect(components[2].wordCount).toBe(3); // "Component 3 content"
    });

    it('should generate unique hashes for each component', () => {
      const components = componentManager.extractComponents();
      const hashes = components.map(c => c.hash);

      expect(new Set(hashes).size).toBe(hashes.length);
    });

    it('should track component positions', () => {
      const components = componentManager.extractComponents();

      expect(components[0].position.start).toBe(0);
      expect(components[0].position.end).toBeGreaterThan(0);
      expect(components[1].position.start).toBeGreaterThan(components[0].position.end);
    });
  });

  describe('detectChanges', () => {
    it('should detect content changes in components', () => {
      const previousComponents = componentManager.extractComponents();

      // Simulate content change
      previousComponents[0].hash = 'old-hash';

      const changes = componentManager.detectChanges(previousComponents);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('content');
      expect(changes[0].previousHash).toBe('old-hash');
    });

    it('should identify downstream impacts of changes', () => {
      const previousComponents = componentManager.extractComponents();
      previousComponents[0].plainText = 'Different content';
      previousComponents[0].hash = 'old-hash';

      const changes = componentManager.detectChanges(previousComponents);

      expect(changes[0].affectsDownstream.voice).toBe(true);
      expect(changes[0].affectsDownstream.scene).toBe(true);
      expect(changes[0].affectsDownstream.edit).toBe(true);
    });
  });

  describe('generateVoiceScript', () => {
    it('should generate voice script with pronunciation overrides', () => {
      const components = componentManager.extractComponents();

      // Add pronunciation override
      components[0].metadata.pronunciationOverrides = {
        'MVHR': 'M-V-H-R'
      };
      components[0].plainText = 'Your MVHR system needs maintenance';

      // Update tracking
      componentManager['components'].set(components[0].id, components[0]);

      const voiceScript = componentManager.generateVoiceScript(components[0].id);

      expect(voiceScript.script).toContain('M-V-H-R');
      expect(voiceScript.script).not.toContain('MVHR');
      expect(voiceScript.pronunciations).toHaveProperty('MVHR', 'M-V-H-R');
    });

    it('should throw error for non-existent component', () => {
      expect(() => {
        componentManager.generateVoiceScript('non-existent-id');
      }).toThrow('Component non-existent-id not found');
    });
  });

  describe('generateSceneMapping', () => {
    it('should generate 1:1 scene mapping for component', () => {
      const components = componentManager.extractComponents();
      componentManager['components'].set(components[0].id, components[0]);

      const sceneMapping = componentManager.generateSceneMapping(components[0].id);

      expect(sceneMapping.sceneNumber).toBe(components[0].componentNumber);
      expect(sceneMapping.componentId).toBe(components[0].id);
      expect(sceneMapping.shotList).toHaveLength(3);
      expect(sceneMapping.requirements).toHaveLength(3);
    });
  });
});

describe('DownstreamSyncManager', () => {
  let componentManager: ComponentManager;
  let syncManager: DownstreamSyncManager;

  beforeEach(() => {
    componentManager = {} as ComponentManager;
    syncManager = new DownstreamSyncManager(componentManager);
  });

  it('should trigger appropriate downstream updates for changes', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    const changes = [{
      componentId: 'test-component',
      previousHash: 'old',
      newHash: 'new',
      changeType: 'content' as const,
      affectsDownstream: {
        voice: true,
        scene: true,
        edit: false
      }
    }];

    await syncManager.handleComponentChanges(changes);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Triggering voice regeneration for component test-component'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Triggering scene update for component test-component'
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      'Triggering edit guidance update for component test-component'
    );
  });
});