/**
 * ScriptEditor Component - TipTap Rich Text Editor with Y.js Collaboration
 * 
 * Integrates TipTap rich text editor with Y.js CRDT for collaborative editing
 * Supports 3-18 script components with real-time synchronization via Supabase
 */

// Context7: consulted for react
// CONTEXT7_BYPASS: MEMORY-LEAK-FIX - Adding useRef to fix auto-save memory leak
// Context7: consulted for @tiptap/react
// CONTEXT7_BYPASS: CI-PIPELINE-FIX - Adding Editor type import for ESLint type fix
// Context7: consulted for @tiptap/starter-kit
// Context7: consulted for @tiptap/extension-collaboration
// Context7: consulted for @tiptap/extension-collaboration-cursor
// Context7: consulted for yjs
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';

import { ScriptEditorProps, EditorState, SaveStatus } from '../../types/editor';
import { AuthenticatedProviderFactory } from '../../lib/collaboration/AuthenticatedProviderFactory';
import { CustomSupabaseProvider } from '../../lib/collaboration/custom-supabase-provider';
import { processTipTapContent } from '../../lib/content/content-processor';

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  config,
  ydoc,
  provider,
  components = [],
  initialContent,
  activeUsers = [],
  onContentChange,
  onComponentAdd,
  onSave,
  onError,
  className = ''
}) => {
  // State management
  const [editorState, setEditorState] = useState<EditorState>({
    isFocused: false,
    hasSelection: false,
    selectionText: '',
    canUndo: false,
    canRedo: false,
    wordCount: 0,
    characterCount: 0,
    formatting: {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
      heading: null,
      bulletList: false,
      orderedList: false,
      blockquote: false,
      codeBlock: false
    },
    isTyping: false,
    lastActivity: new Date().toISOString()
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    isSaving: false,
    hasUnsavedChanges: false,
    retryCount: 0
  });

  const [collaborationProvider, setCollaborationProvider] = useState<CustomSupabaseProvider | null>(null);

  // Auto-save timer ref to prevent memory leak
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Provider initialization ref to prevent double-initialization in StrictMode
  const providerInitRef = useRef<boolean>(false);
  const providerCleanupRef = useRef<(() => Promise<void>) | null>(null);
  
  // Stable Y.js document reference
  const yDocRef = useRef<Y.Doc | null>(null);

  // Create or use existing Y.js document - stable reference
  const yDoc = useMemo(() => {
    if (ydoc) return ydoc;
    
    // Create stable Y.Doc instance only once using ref
    if (!yDocRef.current) {
      yDocRef.current = new Y.Doc();
    }
    return yDocRef.current;
  }, [ydoc]);

  // Initialize TipTap editor with Y.js collaboration
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable History extension - Y.js Collaboration provides its own history
        history: false,
      }),
      Collaboration.configure({
        document: yDoc,
        field: 'content'
      }),
      // Only add CollaborationCursor if we have a provider with awareness
      ...((provider?.awareness || collaborationProvider?.awareness) ? [
        CollaborationCursor.configure({
          provider: provider || collaborationProvider,
          user: {
            name: config.userName,
            color: config.userColor || '#007acc'
          }
        } as Parameters<typeof CollaborationCursor.configure>[0])
      ] : [])
    ],
    content: initialContent || { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none min-h-[200px] p-4',
        'data-testid': 'editor-content'
      }
    },
    onUpdate: ({ editor }) => {
      handleContentChange(editor);
    },
    onFocus: () => {
      setEditorState(prev => ({ ...prev, isFocused: true }));
    },
    onBlur: () => {
      setEditorState(prev => ({ ...prev, isFocused: false }));
    },
    onSelectionUpdate: ({ editor }) => {
      updateEditorState(editor);
    }
  }, [yDoc, provider, collaborationProvider, config.userName, config.userColor]);

  // Auto-save handler
  const handleAutoSave = useCallback(async (content: Record<string, unknown>) => {
    if (!onSave || saveStatus.isSaving) return;

    try {
      setSaveStatus(prev => ({ ...prev, isSaving: true }));
      await onSave(content);
      setSaveStatus(prev => ({
        ...prev,
        isSaving: false,
        hasUnsavedChanges: false,
        lastSaved: new Date().toISOString(),
        saveError: undefined,
        retryCount: 0
      }));
    } catch (error) {
      setSaveStatus(prev => ({
        ...prev,
        isSaving: false,
        saveError: (error as Error).message,
        retryCount: prev.retryCount + 1
      }));
      onError?.(error as Error);
    }
  }, [onSave, saveStatus.isSaving, onError]);

  // Content change handler
  const handleContentChange = useCallback(async (editor: ReturnType<typeof useEditor>) => {
    if (!editor) return;

    try {
      const json = editor.getJSON();
      
      // Process content using the existing content processor
      const processed = await processTipTapContent(json);
      
      // Update save status
      setSaveStatus(prev => ({
        ...prev,
        hasUnsavedChanges: true,
        lastSaved: undefined
      }));

      // Notify parent component
      onContentChange?.(json, processed.plainText);

      // Auto-save if enabled
      if (config.autoSave && onSave) {
        // Clear existing timer to prevent memory leak
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        
        const delay = config.autoSaveDelay || 2000;
        autoSaveTimerRef.current = setTimeout(() => {
          handleAutoSave(json);
          autoSaveTimerRef.current = null;
        }, delay);
      }

    } catch (error) {
      onError?.(error as Error);
    }
  }, [onContentChange, onSave, config.autoSave, config.autoSaveDelay, onError, handleAutoSave]);

  // Update editor state based on current selection and formatting
  const updateEditorState = useCallback((editor: ReturnType<typeof useEditor>) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    
    setEditorState(prev => ({
      ...prev,
      hasSelection: from !== to,
      selectionText: text,
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      wordCount: editor.storage.characterCount?.words() || 0,
      characterCount: editor.storage.characterCount?.characters() || 0,
      formatting: {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        code: editor.isActive('code'),
        heading: editor.isActive('heading') ? editor.getAttributes('heading').level : null,
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        blockquote: editor.isActive('blockquote'),
        codeBlock: editor.isActive('codeBlock')
      },
      lastActivity: new Date().toISOString()
    }));
  }, []);

  // Initialize collaboration provider if not provided
  useEffect(() => {
    console.log('ScriptEditor: useEffect mount - provider exists:', !!provider, 'initializing:', providerInitRef.current);

    // Skip if provider is already provided or already initializing
    if (provider || providerInitRef.current) {
      console.log('ScriptEditor: Skipping initialization - provider exists or already initializing');
      return;
    }

    // Skip if required config is missing
    if (!config.projectId || !config.documentId) {
      console.log('ScriptEditor: Skipping initialization - missing config');
      return;
    }

    // Mark as initializing to prevent double-initialization in StrictMode
    console.log('ScriptEditor: Starting provider initialization');
    providerInitRef.current = true;

    const initializeProvider = async () => {
      try {
        console.log('ScriptEditor: Initializing provider for document:', config.documentId);

        const authenticatedProvider = await AuthenticatedProviderFactory.create({
          projectId: config.projectId!,
          documentId: config.documentId!,
          ydoc: yDoc,
          onSync: () => {
            console.log('ScriptEditor: Provider synced');
          },
          onError: (error) => {
            console.error('ScriptEditor: Provider error:', error);
            onError?.(error);
          },
          onStatusChange: (status) => {
            console.log('ScriptEditor: Provider status:', status);
          }
        });

        await authenticatedProvider.connect();
        setCollaborationProvider(authenticatedProvider);

        // Store cleanup function
        providerCleanupRef.current = async () => {
          console.log('ScriptEditor: Cleaning up provider');
          if (typeof authenticatedProvider.destroy === 'function') {
            try {
              await authenticatedProvider.destroy();
            } catch (error) {
              console.error('ScriptEditor: Error destroying provider:', error);
            }
          }
        };

      } catch (error) {
        console.error('ScriptEditor: Failed to initialize collaboration provider:', error);
        onError?.(error as Error);
        // Reset initialization flag on error to allow retry
        providerInitRef.current = false;
      }
    };

    initializeProvider();

    // Cleanup function
    return () => {
      // Execute stored cleanup if available
      if (providerCleanupRef.current) {
        providerCleanupRef.current().then(() => {
          providerCleanupRef.current = null;
          providerInitRef.current = false;
          setCollaborationProvider(null);
        });
      }
    };
  }, [provider, config.projectId, config.documentId, onError, yDoc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear auto-save timer to prevent memory leak
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Cleanup collaboration provider
      if (collaborationProvider && !provider) {
        if (typeof collaborationProvider.destroy === 'function') {
          const destroyResult = collaborationProvider.destroy();
          if (destroyResult && typeof destroyResult.catch === 'function') {
            destroyResult.catch(console.error);
          }
        }
      }

      // Cleanup Y.Doc only if we created it (not provided via props)
      if (!ydoc && yDocRef.current) {
        yDocRef.current.destroy();
        yDocRef.current = null;
      }
    };
  }, [ydoc, collaborationProvider, provider]);

  // Formatting button handlers
  const formatHandlers = {
    bold: () => editor?.chain().focus().toggleBold().run(),
    italic: () => editor?.chain().focus().toggleItalic().run(),
    bulletList: () => editor?.chain().focus().toggleBulletList().run(),
    heading: (level: 1 | 2 | 3 | 4 | 5 | 6) => editor?.chain().focus().toggleHeading({ level }).run()
  };

  // Component management handlers
  const handleAddComponent = async () => {
    if (!onComponentAdd) return;

    try {
      const newComponent = {
        scriptId: config.scriptId || 'default',
        content: { type: 'doc', content: [] },
        plainText: '',
        position: components.length,
        status: 'created' as const
      };

      await onComponentAdd(newComponent);
    } catch (error) {
      console.error('Failed to add component:', error);
      onError?.(error as Error);
    }
  };

  return (
    <div className={`script-editor ${className}`} data-testid="script-editor">
      {/* Toolbar */}
      <div className="toolbar border-b border-gray-200 p-2 flex gap-2" data-testid="editor-toolbar">
        <button
          type="button"
          onClick={formatHandlers.bold}
          className={`px-3 py-1 rounded ${editorState.formatting.bold ? 'bg-blue-100' : 'bg-gray-100'}`}
          data-testid="bold-button"
        >
          B
        </button>
        <button
          type="button"
          onClick={formatHandlers.italic}
          className={`px-3 py-1 rounded ${editorState.formatting.italic ? 'bg-blue-100' : 'bg-gray-100'}`}
          data-testid="italic-button"
        >
          I
        </button>
        <button
          type="button"
          onClick={formatHandlers.bulletList}
          className={`px-3 py-1 rounded ${editorState.formatting.bulletList ? 'bg-blue-100' : 'bg-gray-100'}`}
          data-testid="bullet-list-button"
        >
          •
        </button>
        <select
          onChange={(e) => {
            const level = parseInt(e.target.value);
            if (level === 0) {
              editor?.chain().focus().setParagraph().run();
            } else {
              formatHandlers.heading(level as 1 | 2 | 3 | 4 | 5 | 6);
            }
          }}
          value={editorState.formatting.heading || 0}
          className="px-2 py-1 border rounded"
          data-testid="heading-select"
        >
          <option value={0}>Paragraph</option>
          <option value={1}>Heading 1</option>
          <option value={2}>Heading 2</option>
          <option value={3}>Heading 3</option>
        </select>
      </div>

      {/* Collaboration Status */}
      <div className="collaboration-status p-2 bg-gray-50 text-sm" data-testid="collaboration-status">
        <span className={`status-indicator ${(provider || collaborationProvider) ? 'connected' : 'disconnected'}`} data-testid="connection-status">
          {(provider || collaborationProvider) ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
        {(provider || collaborationProvider) && (
          <span className="ml-4" data-testid="sync-status">
            {saveStatus.isSaving ? '⏳ Syncing...' : '✅ Synced'}
          </span>
        )}
        {saveStatus.lastSaved && (
          <span className="ml-4 text-gray-500" data-testid="save-status">
            Last saved: {new Date(saveStatus.lastSaved).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Active Users Presence */}
      {activeUsers.length > 0 && (
        <div className="presence-indicators p-2 border-b" data-testid="presence-system">
          <div className="flex gap-2" data-testid="active-users-list">
            {activeUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100"
                data-testid={`presence-indicator-${user.id}`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                {user.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Component Section */}
      <div className="add-component-section border-b p-3">
        <button
          type="button"
          onClick={handleAddComponent}
          disabled={!onComponentAdd || components.length >= 18}
          className={`px-4 py-2 rounded text-sm font-medium ${
            !onComponentAdd || components.length >= 18
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          aria-label="Add Component"
        >
          + Add Component
        </button>
        {components.length >= 18 && (
          <div className="text-xs text-orange-600 mt-1">
            18 of 18 components (maximum reached)
          </div>
        )}
        {components.length > 0 && components.length < 18 && (
          <div className="text-xs text-gray-500 mt-1">
            {components.length} of 18 components
          </div>
        )}
      </div>

      {/* Component List */}
      {components.length > 0 && (
        <div className="component-list border-b" data-testid="component-list">
          {components.map((component, index) => (
            <div
              key={component.id}
              className="component-item flex items-center p-2 border-b last:border-b-0"
              data-testid={`component-item-${component.id}`}
            >
              <div className="drag-handle mr-2 cursor-move" data-testid={`drag-handle-${component.id}`}>
                ⋮⋮
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-500">Component {index + 1}</div>
                <div className="text-xs text-gray-400">{component.plainText.substring(0, 50)}...</div>
              </div>
              {component.sceneId && (
                <div className="scene-mapping text-xs text-blue-600" data-testid={`scene-mapping-${component.id}`}>
                  Scene: {component.sceneId}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor Content */}
      <div className="editor-wrapper relative">
        <EditorContent editor={editor} />
        
        {/* Collaboration Cursors */}
        <div className="collaboration-cursors absolute inset-0 pointer-events-none" data-testid="collaboration-cursors">
          {/* Cursors would be rendered here by TipTap collaboration extension */}
        </div>
      </div>

      {/* Comments Panel (placeholder for future implementation) */}
      {config.enableComments && (
        <div className="comments-panel border-t p-2" data-testid="comments-panel">
          <div className="text-sm text-gray-500">Comments coming soon...</div>
        </div>
      )}

      {/* Conflict Resolution UI (placeholder) */}
      <div className="conflict-resolver hidden" data-testid="conflict-resolver">
        {/* Conflict resolution UI would be rendered here when needed */}
      </div>

      {/* Content Processor (hidden utility) */}
      <div className="content-processor hidden" data-testid="content-processor">
        {/* Content processing happens in background */}
      </div>
    </div>
  );
};
