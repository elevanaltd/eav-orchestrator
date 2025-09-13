/**
 * Editor Types for TipTap Script Editor Integration
 * 
 * Defines TypeScript interfaces for collaborative script editing
 * with Y.js CRDT and TipTap rich text features
 */

// Context7: consulted for yjs
import * as Y from 'yjs';
import { CustomSupabaseProvider } from '../lib/collaboration/custom-supabase-provider';

// TipTap JSON Content Type (matches TipTap's JSONContent)
export interface EditorJSONContent {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: EditorJSONContent[];
  marks?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
  }>;
  text?: string;
}

// Script Component representing a single component in the script
export interface ScriptComponent {
  id: string;
  scriptId: string;
  content: EditorJSONContent;
  plainText: string;
  position: number;
  sceneId?: string; // 1:1 component-to-scene mapping
  status: 'created' | 'in_edit' | 'approved';
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string;
  version: number; // Optimistic locking
}

// User presence information for collaboration
export interface UserPresence {
  id: string;
  name: string;
  email?: string;
  cursor?: {
    x: number;
    y: number;
  };
  selection?: {
    anchor: number;
    head: number;
  };
  color: string; // Collaboration cursor color
  isActive: boolean;
  lastSeen: string;
}

// Collaboration status and metrics
export interface CollaborationStatus {
  isConnected: boolean;
  isSynced: boolean;
  latency: number; // in milliseconds
  activeUsers: UserPresence[];
  connectionAttempts: number;
  lastSyncTime?: string;
  errors: string[];
}

// Editor configuration
export interface ScriptEditorConfig {
  projectId?: string; // Required for authenticated provider initialization
  documentId?: string; // Required for authenticated provider initialization
  scriptId?: string;
  userId: string;
  userName: string;
  userColor?: string;
  autoSave?: boolean;
  autoSaveDelay?: number; // milliseconds
  maxComponents?: number; // 3-18 components per script
  enableComments?: boolean;
  enablePresence?: boolean;
  readOnly?: boolean;
}

// Script Editor Component Props
export interface ScriptEditorProps {
  config: ScriptEditorConfig;
  ydoc?: Y.Doc;
  provider?: CustomSupabaseProvider;
  components?: ScriptComponent[];
  initialContent?: EditorJSONContent;
  activeUsers?: UserPresence[];
  onContentChange?: (content: EditorJSONContent, plainText: string) => void;
  onComponentAdd?: (component: Partial<ScriptComponent>) => Promise<ScriptComponent>;
  onComponentUpdate?: (componentId: string, updates: Partial<ScriptComponent>) => Promise<void>;
  onComponentDelete?: (componentId: string) => Promise<void>;
  onComponentReorder?: (componentIds: string[]) => Promise<void>;
  onSave?: (content: EditorJSONContent) => Promise<void>;
  onError?: (error: Error) => void;
  className?: string;
}

// Rich text formatting options
export interface FormattingOptions {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  heading: number | null; // 1-6 for heading levels, null for paragraph
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
}

// Editor state for managing current formatting and selection
export interface EditorState {
  isFocused: boolean;
  hasSelection: boolean;
  selectionText: string;
  canUndo: boolean;
  canRedo: boolean;
  wordCount: number;
  characterCount: number;
  formatting: FormattingOptions;
  isTyping: boolean;
  lastActivity: string;
}

// Conflict resolution for optimistic locking
export interface ConflictResolution {
  componentId: string;
  localVersion: number;
  remoteVersion: number;
  localContent: EditorJSONContent;
  remoteContent: EditorJSONContent;
  mergedContent?: EditorJSONContent;
  strategy: 'local' | 'remote' | 'merge' | 'manual';
  resolvedAt?: string;
  resolvedBy?: string;
}

// Auto-save status
export interface SaveStatus {
  isSaving: boolean;
  lastSaved?: string;
  hasUnsavedChanges: boolean;
  saveError?: string;
  retryCount: number;
}

// Performance metrics for collaboration
export interface PerformanceMetrics {
  renderTime: number; // Component render time in ms
  syncLatency: number; // Y.js sync latency in ms
  saveLatency: number; // Database save latency in ms
  memoryUsage?: number; // Memory usage in MB
  updateFrequency: number; // Updates per second
  lastMeasured: string;
}

// Editor toolbar configuration
export interface ToolbarConfig {
  showFormatting: boolean;
  showHeadings: boolean;
  showLists: boolean;
  showInsert: boolean;
  showUndo: boolean;
  showSave: boolean;
  showStatus: boolean;
  customButtons?: ToolbarButton[];
}

export interface ToolbarButton {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  tooltip?: string;
}

// Comment system types (for future implementation)
export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  position: number; // Character position in document
  componentId?: string;
  createdAt: string;
  updatedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: Comment[];
}

// Types are already exported individually above
