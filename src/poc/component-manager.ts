/**
 * Component Manager for Single Editor Architecture
 *
 * This module handles the extraction, tracking, and downstream synchronization
 * of components from a single TipTap editor instance.
 */

import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

// ============================================
// TYPES
// ============================================

export interface ScriptComponent {
  id: string;
  componentNumber: number;
  type: ComponentType;
  content: string;
  plainText: string;
  wordCount: number;
  approvalStatus: ApprovalStatus;
  hash: string;
  metadata: ComponentMetadata;
  position: {
    start: number;
    end: number;
  };
}

export type ComponentType =
  | 'introduction'
  | 'scene_heading'
  | 'action'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'operations'
  | 'maintenance'
  | 'safety'
  | 'support';

export type ApprovalStatus = 'draft' | 'review' | 'approved';

export interface ComponentMetadata {
  createdAt: string;
  lastModified: string;
  modifiedBy?: string;
  voiceGenerated?: boolean;
  voiceHash?: string;
  sceneGenerated?: boolean;
  sceneHash?: string;
  pronunciationOverrides?: Record<string, string>;
}

export interface ComponentChange {
  componentId: string;
  previousHash: string;
  newHash: string;
  changeType: 'content' | 'type' | 'approval';
  affectsDownstream: {
    voice: boolean;
    scene: boolean;
    edit: boolean;
  };
}

// ============================================
// COMPONENT EXTRACTION
// ============================================

export class ComponentManager {
  private editor: Editor;
  private components: Map<string, ScriptComponent> = new Map();
  private componentHashes: Map<string, string> = new Map();

  constructor(editor: Editor) {
    this.editor = editor;
  }

  /**
   * Extract all components from the editor document
   */
  extractComponents(): ScriptComponent[] {
    const components: ScriptComponent[] = [];
    const doc = this.editor.state.doc;

    let currentComponent: Partial<ScriptComponent> | null = null;
    let componentStartPos = 0;

    doc.forEach((node: ProseMirrorNode, offset: number) => {
      if (node.type.name === 'componentDivider') {
        // If we have a previous component, finalize it
        if (currentComponent && currentComponent.content) {
          this.finalizeComponent(currentComponent, componentStartPos, offset);
          components.push(currentComponent as ScriptComponent);
        }

        // Start a new component
        currentComponent = {
          id: node.attrs.componentId || this.generateComponentId(),
          componentNumber: node.attrs.componentNumber,
          type: node.attrs.componentType,
          approvalStatus: node.attrs.approvalStatus,
          metadata: node.attrs.metadata || this.createDefaultMetadata(),
          content: '',
          plainText: '',
          wordCount: 0,
          hash: '',
          position: { start: offset, end: offset }
        };
        componentStartPos = offset + node.nodeSize;
      } else if (currentComponent) {
        // Add content to current component
        if (node.isTextblock) {
          currentComponent.content += this.nodeToHTML(node) + '\n';
          currentComponent.plainText += node.textContent + '\n';
        }
      }
    });

    // Don't forget the last component
    if (currentComponent && currentComponent.content) {
      this.finalizeComponent(currentComponent, componentStartPos, doc.nodeSize);
      components.push(currentComponent as ScriptComponent);
    }

    // Update internal tracking
    this.updateComponentTracking(components);

    return components;
  }

  /**
   * Finalize a component with calculated properties
   */
  private finalizeComponent(
    component: Partial<ScriptComponent>,
    startPos: number,
    endPos: number
  ): void {
    component.position = { start: startPos, end: endPos };
    component.plainText = component.plainText?.trim() || '';
    component.content = component.content?.trim() || '';
    component.wordCount = this.countWords(component.plainText);
    component.hash = this.generateHash(component.plainText);
  }

  /**
   * Detect changes between current and previous component states
   */
  detectChanges(previousComponents: ScriptComponent[]): ComponentChange[] {
    const changes: ComponentChange[] = [];
    const currentComponents = this.extractComponents();

    const previousMap = new Map(previousComponents.map(c => [c.id, c]));
    const currentMap = new Map(currentComponents.map(c => [c.id, c]));

    // Check for changes in existing components
    for (const [id, current] of currentMap) {
      const previous = previousMap.get(id);
      if (previous) {
        if (previous.hash !== current.hash) {
          changes.push({
            componentId: id,
            previousHash: previous.hash,
            newHash: current.hash,
            changeType: 'content',
            affectsDownstream: this.analyzeDownstreamImpact(previous, current)
          });
        }
      }
    }

    return changes;
  }

  /**
   * Analyze what downstream systems are affected by a component change
   */
  private analyzeDownstreamImpact(
    previous: ScriptComponent,
    current: ScriptComponent
  ): { voice: boolean; scene: boolean; edit: boolean } {
    const contentChanged = previous.plainText !== current.plainText;
    const typeChanged = previous.type !== current.type;

    return {
      voice: contentChanged, // Voice needs regeneration if content changed
      scene: contentChanged || typeChanged, // Scene affected by content or type changes
      edit: contentChanged || typeChanged // Edit directions affected by any change
    };
  }

  /**
   * Generate voice script for a specific component
   */
  generateVoiceScript(componentId: string): {
    script: string;
    pronunciations: Record<string, string>;
  } {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    // Apply pronunciation overrides
    let script = component.plainText;
    const pronunciations = component.metadata.pronunciationOverrides || {};

    // Apply stored pronunciations (e.g., "MVHR" → "M-V-H-R")
    for (const [original, replacement] of Object.entries(pronunciations)) {
      script = script.replace(new RegExp(original, 'g'), replacement);
    }

    return {
      script,
      pronunciations
    };
  }

  /**
   * Generate scene mapping for a component
   */
  generateSceneMapping(componentId: string): {
    sceneNumber: number;
    componentId: string;
    shotList: string[];
    requirements: string[];
  } {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    // This would use AI or templates to generate scene details
    // For POC, we'll return mock data
    return {
      sceneNumber: component.componentNumber,
      componentId: component.id,
      shotList: [
        `Wide shot - ${component.type}`,
        `Medium shot - Detail`,
        `Close-up - Key element`
      ],
      requirements: [
        'Good lighting',
        'Clean environment',
        'Required props ready'
      ]
    };
  }

  /**
   * Smart merge: Update content while preserving customizations
   */
  smartMerge(
    componentId: string,
    newContent: string,
    preserveCustomizations: boolean = true
  ): void {
    const component = this.components.get(componentId);
    if (!component) return;

    if (preserveCustomizations && component.metadata.pronunciationOverrides) {
      // Re-apply pronunciation overrides to new content
      // This preserves things like "MVHR → M-V-H-R" even after content updates
      // Implementation would go here
    }

    // Update component content
    // This would update the editor's actual content
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  private generateComponentId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private nodeToHTML(node: ProseMirrorNode): string {
    // Convert ProseMirror node to HTML string
    // Simplified for POC
    if (node.type.name === 'paragraph') {
      return `<p>${node.textContent}</p>`;
    } else if (node.type.name === 'heading') {
      const level = node.attrs.level || 1;
      return `<h${level}>${node.textContent}</h${level}>`;
    }
    return node.textContent;
  }

  private createDefaultMetadata(): ComponentMetadata {
    return {
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      voiceGenerated: false,
      sceneGenerated: false
    };
  }

  private updateComponentTracking(components: ScriptComponent[]): void {
    this.components.clear();
    this.componentHashes.clear();

    for (const component of components) {
      this.components.set(component.id, component);
      this.componentHashes.set(component.id, component.hash);
    }
  }
}

// ============================================
// DOWNSTREAM SYNC MANAGER
// ============================================

export class DownstreamSyncManager {
  private componentManager: ComponentManager;

  constructor(componentManager: ComponentManager) {
    this.componentManager = componentManager;
  }

  /**
   * Handle component changes and trigger appropriate downstream updates
   */
  async handleComponentChanges(changes: ComponentChange[]): Promise<void> {
    for (const change of changes) {
      if (change.affectsDownstream.voice) {
        await this.triggerVoiceRegeneration(change.componentId);
      }

      if (change.affectsDownstream.scene) {
        await this.triggerSceneUpdate(change.componentId);
      }

      if (change.affectsDownstream.edit) {
        await this.triggerEditGuidanceUpdate(change.componentId);
      }
    }
  }

  private async triggerVoiceRegeneration(componentId: string): Promise<void> {
    console.log(`Triggering voice regeneration for component ${componentId}`);
    // Would call ElevenLabs API here
  }

  private async triggerSceneUpdate(componentId: string): Promise<void> {
    console.log(`Triggering scene update for component ${componentId}`);
    // Would update scene planning here
  }

  private async triggerEditGuidanceUpdate(componentId: string): Promise<void> {
    console.log(`Triggering edit guidance update for component ${componentId}`);
    // Would update edit directions here
  }
}

export default ComponentManager;