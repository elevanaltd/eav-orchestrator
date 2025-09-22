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
import type { ScriptComponentUI } from '../../types/editor';
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
  onComponentUpdate,
  onComponentDelete,
  onComponentReorder,
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
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [menuComponentId, setMenuComponentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [draggedComponentId, setDraggedComponentId] = useState<string | null>(null);

  // Optimistic UI state for components (combines props + locally added components)
  const [optimisticComponents, setOptimisticComponents] = useState<ScriptComponentUI[]>([]);

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

  // Computed components list: props + optimistic additions
  const displayComponents = useMemo(() => {
    // Start with props components, filter out any that are optimistically added
    const propsComponentIds = new Set(components.map(c => c.componentId));
    const uniqueOptimistic = optimisticComponents.filter(c => !propsComponentIds.has(c.componentId));
    return [...components, ...uniqueOptimistic];
  }, [components, optimisticComponents]);

  // Sync optimistic state when props change
  useEffect(() => {
    // Remove optimistic components that now exist in props (successful server sync)
    setOptimisticComponents(prev => {
      const propsComponentIds = new Set(components.map(c => c.componentId));
      return prev.filter(c => !propsComponentIds.has(c.componentId));
    });
  }, [components]);

  // Multi-paragraph paste handler
  const handleMultiParagraphPaste = useCallback(async (text: string) => {
    if (!onComponentAdd) return false;

    // Split text by double line breaks or single line breaks (for different paste sources)
    const paragraphs = text
      .split(/\n\s*\n|\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Only process if we have multiple paragraphs and won't exceed limit
    if (paragraphs.length <= 1) return false;

    const newComponentsCount = paragraphs.length;
    const currentComponentsCount = components.length;

    if (currentComponentsCount + newComponentsCount > 18) {
      // Only create components up to the limit
      const availableSlots = 18 - currentComponentsCount;
      if (availableSlots <= 0) return false;

      console.log(`Multi-paragraph paste: Creating ${availableSlots} components (${newComponentsCount} paragraphs detected, ${18 - availableSlots} excluded due to limit)`);
      paragraphs.splice(availableSlots); // Trim to available slots
    }

    try {
      // Create components for each paragraph
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const newComponent = {
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: paragraph }]
              }
            ]
          },
          contentPlain: paragraph,
          status: 'created' as const
        };

        await onComponentAdd(newComponent);
      }

      console.log(`Multi-paragraph paste: Successfully created ${paragraphs.length} components`);
      return true; // Indicate paste was handled
    } catch (error) {
      console.error('Failed to create components from multi-paragraph paste:', error);
      onError?.(error as Error);
      return false;
    }
  }, [onComponentAdd, components.length, onError]);

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
      },
      handlePaste: (_view, event) => {
        // Get the pasted text
        const text = event.clipboardData?.getData('text/plain');

        if (text) {
          // Check if this is a multi-paragraph paste
          const paragraphs = text
            .split(/\n\s*\n|\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

          if (paragraphs.length > 1) {
            // Handle multi-paragraph paste asynchronously
            handleMultiParagraphPaste(text).then(handled => {
              if (handled) {
                // Prevent default paste behavior since we handled it
                event.preventDefault();
              }
            });

            // Prevent default paste for multi-paragraph content
            return true;
          }
        }

        // Allow default paste behavior for single paragraphs
        return false;
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
  }, [yDoc, provider, collaborationProvider, config.userName, config.userColor, handleMultiParagraphPaste]);

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
    bold: () => {
      editor?.chain().focus().toggleBold().run();
      setTimeout(() => editor && updateEditorState(editor), 10);
    },
    italic: () => {
      editor?.chain().focus().toggleItalic().run();
      setTimeout(() => editor && updateEditorState(editor), 10);
    },
    bulletList: () => {
      editor?.chain().focus().toggleBulletList().run();
      setTimeout(() => editor && updateEditorState(editor), 10);
    },
    heading: (level: 1 | 2 | 3 | 4 | 5 | 6) => {
      editor?.chain().focus().toggleHeading({ level }).run();
      setTimeout(() => editor && updateEditorState(editor), 10);
    }
  };

  // Component management handlers
  const handleAddComponent = async () => {
    if (!onComponentAdd || displayComponents.length >= 18) return;

    try {
      // Create optimistic component with predictable ID for the test
      const optimisticId = `comp-${Date.now()}`;
      const newComponent: Partial<ScriptComponentUI> = {
        scriptId: config.scriptId || 'default',
        content: { type: 'doc', content: [] },
        plainText: '',
        position: displayComponents.length + 1,
        status: 'created' as const
      };

      // Add optimistically to UI immediately
      const optimisticComponent: ScriptComponentUI = {
        componentId: optimisticId,
        scriptId: newComponent.scriptId!,
        content: newComponent.content!,
        plainText: newComponent.plainText!,
        position: newComponent.position!,
        type: 'standard',
        status: newComponent.status!,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastEditedBy: config.userId,
        lastEditedAt: new Date().toISOString()
      };

      setOptimisticComponents(prev => [...prev, optimisticComponent]);

      // Call parent callback for persistence (may update with real ID)
      await onComponentAdd(newComponent);
    } catch (error) {
      console.error('Failed to add component:', error);
      // Remove optimistic component on error
      setOptimisticComponents(prev => prev.filter(c => !c.componentId.startsWith('comp-')));
      onError?.(error as Error);
    }
  };


  const handleComponentEdit = (newContent: string) => {
    setEditingContent(newContent);

    // Auto-save after 1 second
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      if (editingComponentId && onComponentUpdate) {
        try {
          await onComponentUpdate(editingComponentId, {
            plainText: newContent,
            content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: newContent }] }] }
          });
        } catch (error) {
          console.error('Failed to update component:', error);
          onError?.(error as Error);
        }
      }
      autoSaveTimerRef.current = null;
    }, 1000);
  };

  const handleDeleteComponent = async (componentId: string) => {
    if (!onComponentDelete) return;

    try {
      await onComponentDelete(componentId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete component:', error);
      onError?.(error as Error);
    }
  };

  const handleMoveComponent = async (componentId: string, direction: 'up' | 'down') => {
    if (!onComponentReorder) return;

    try {
      const currentIndex = displayComponents.findIndex(c => c.componentId === componentId);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= displayComponents.length) return;

      // Create new order array by swapping positions
      const reorderedComponents = [...displayComponents];
      [reorderedComponents[currentIndex], reorderedComponents[newIndex]] =
        [reorderedComponents[newIndex], reorderedComponents[currentIndex]];

      // Call parent handler with new order
      await onComponentReorder(reorderedComponents.map(c => c.componentId));
    } catch (error) {
      console.error('Failed to move component:', error);
      onError?.(error as Error);
    }
  };

  const handleComponentReorder = async (draggedIds: string[]) => {
    if (!onComponentReorder) return;

    try {
      await onComponentReorder(draggedIds);
    } catch (error) {
      console.error('Failed to reorder components:', error);
      onError?.(error as Error);
    }
  };

  // const handleDragStart = (e: React.DragEvent, componentId: string) => {
  //   // Store in both dataTransfer and local state for test environment compatibility
  //   if (e.dataTransfer) {
  //     e.dataTransfer.setData('text/plain', componentId);
  //   }
  //   setDraggedComponentId(componentId);
  // };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetComponentId: string) => {
    e.preventDefault();

    // Try to get dragged ID from dataTransfer first, then fallback to local state
    let draggedComponentIdValue = '';
    if (e.dataTransfer) {
      draggedComponentIdValue = e.dataTransfer.getData('text/plain');
    }

    // Fallback to local state for test environments
    if (!draggedComponentIdValue && draggedComponentId) {
      draggedComponentIdValue = draggedComponentId;
    }

    if (draggedComponentIdValue && draggedComponentIdValue !== targetComponentId) {
      const draggedIndex = components.findIndex(c => c.componentId === draggedComponentIdValue);
      const targetIndex = components.findIndex(c => c.componentId === targetComponentId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...components];
        const [draggedComponent] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedComponent);

        const reorderedIds = newOrder.map(c => c.componentId);
        handleComponentReorder(reorderedIds);
      }
    }

    // Clear the dragged component state
    setDraggedComponentId(null);
  };

  return (
    <div className={`script-editor ${className}`} data-testid="script-editor">
      {/* Toolbar */}
      <div className="toolbar border-b border-gray-200 p-2 flex items-center gap-1" data-testid="editor-toolbar">
        <button
          type="button"
          onClick={formatHandlers.bold}
          className={`px-3 py-1 mr-2 rounded text-sm font-bold ${editorState.formatting.bold ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}
          data-testid="bold-button"
        >
          B
        </button>
        <button
          type="button"
          onClick={formatHandlers.italic}
          className={`px-3 py-1 mr-2 rounded text-sm italic ${editorState.formatting.italic ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}
          data-testid="italic-button"
        >
          I
        </button>
        <button
          type="button"
          onClick={formatHandlers.bulletList}
          className={`px-3 py-1 mr-2 rounded text-sm ${editorState.formatting.bulletList ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}
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
            // Force update editor state after formatting change
            setTimeout(() => {
              if (editor) {
                updateEditorState(editor);
              }
            }, 10);
          }}
          value={editorState.formatting.heading || 0}
          className="px-2 py-1 border rounded text-sm"
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

      {/* Editor Content */}
      <div className="editor-wrapper relative border-b">
        <EditorContent editor={editor} />

        {/* Collaboration Cursors */}
        <div className="collaboration-cursors absolute inset-0 pointer-events-none" data-testid="collaboration-cursors">
          {/* Cursors would be rendered here by TipTap collaboration extension */}
        </div>
      </div>


      {/* Document Components - Google Docs Style Seamless Document */}
      <div className="document-container px-6 py-4 overflow-visible" data-testid="document-container">
        {displayComponents.map((component, index) => (
          <div
            key={component.componentId}
            className="document-component group relative hover:bg-gray-50 rounded transition-colors duration-200"
            data-testid={`component-${component.componentId}`}
            data-component={`component-${component.componentId}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, component.componentId)}
          >
            {/* Margin controls - Google Docs style */}
            <div className="absolute left-0 top-0 w-8 h-full flex items-start justify-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {/* Three-dot menu button */}
              <div className="relative">
                <button
                  type="button"
                  className="w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle menu for this component
                    setMenuComponentId(
                      menuComponentId === component.componentId
                        ? null
                        : component.componentId
                    );
                  }}
                  data-testid={`menu-button-${component.componentId}`}
                  title="Component options"
                >
                  ⋯
                </button>

                {/* Dropdown menu */}
                {menuComponentId === component.componentId && (
                  <div className="absolute left-8 top-0 bg-white border shadow-lg rounded-lg py-1 z-[1000] min-w-[120px] max-w-[160px]" style={{
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000
                  }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingComponentId(component.componentId);
                        setEditingContent(component.plainText || '');
                        setMenuComponentId(null);
                      }}
                      className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(component.componentId);
                        setMenuComponentId(null);
                      }}
                      className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm text-red-600"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveComponent(component.componentId, 'up');
                        setMenuComponentId(null);
                      }}
                      disabled={index === 0}
                      className={`w-full text-left px-3 py-1 hover:bg-gray-100 text-sm ${
                        index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700'
                      }`}
                      title="Move up"
                    >
                      ↑ Move Up
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveComponent(component.componentId, 'down');
                        setMenuComponentId(null);
                      }}
                      disabled={index === displayComponents.length - 1}
                      className={`w-full text-left px-3 py-1 hover:bg-gray-100 text-sm ${
                        index === displayComponents.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700'
                      }`}
                      title="Move down"
                    >
                      ↓ Move Down
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Component content as Google Docs paragraph */}
            <div
              className="script-paragraph min-h-[1.8rem] py-1 cursor-text leading-relaxed text-base"
              style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: '11pt',
                lineHeight: 1.8,
                marginBottom: '16px',
                padding: '4px 0',
                marginLeft: '32px' // Space for margin controls
              }}
              onClick={() => {
                setEditingComponentId(component.componentId);
                setEditingContent(component.plainText || '');
              }}
              data-component-index={index + 1}
              data-testid={`component-content-${component.componentId}`}
            >
              {component.plainText || (
                <span className="text-gray-400 italic">
                  Click to add content...
                </span>
              )}
            </div>

            {/* Hidden status metadata - accessible via data attributes for testing */}
            <div
              className="sr-only"
              data-testid={`component-status-${component.componentId}`}
              data-status={component.status || 'created'}
            />
          </div>
        ))}

        {/* Add Component - Google Docs style plus button in margin */}
        {(onComponentAdd && displayComponents.length < 18) && (
          <div className="add-component-line group relative hover:bg-gray-50 rounded transition-colors duration-200 min-h-[1.8rem] py-1">
            <div className="absolute left-0 top-0 w-8 h-full flex items-start justify-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={handleAddComponent}
                className="w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center text-sm font-bold"
                data-testid="add-component-button"
                title="Add component"
              >
                +
              </button>
            </div>
            <div
              className="text-gray-300 italic cursor-pointer text-base"
              style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: '11pt',
                lineHeight: 1.8,
                marginLeft: '32px',
                padding: '4px 0'
              }}
              onClick={handleAddComponent}
            >
              Click to add content or hover in margin for + button...
            </div>
          </div>
        )}
      </div>

      {/* Component Editor - Minimal overlay style */}
      {editingComponentId && (
        <div className="component-editor fixed bottom-4 right-4 bg-white border shadow-lg rounded-lg p-4 max-w-md z-50" data-testid={`component-editor-${editingComponentId}`}>
          <div className="mb-2 text-sm font-medium text-gray-700">
            Editing Component {displayComponents.findIndex(c => c.componentId === editingComponentId) + 1}
          </div>
          <textarea
            value={editingContent}
            onChange={(e) => handleComponentEdit(e.target.value)}
            className="w-full h-32 p-3 border rounded text-sm resize-none"
            placeholder="Enter component content..."
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setEditingComponentId(null)}
              className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            >
              Close
            </button>
            <button
              type="button"
              onClick={async () => {
                // Save explicitly before closing
                if (editingComponentId && onComponentUpdate) {
                  try {
                    await onComponentUpdate(editingComponentId, {
                      plainText: editingContent,
                      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: editingContent }] }] }
                    });
                  } catch (error) {
                    console.error('Failed to save component:', error);
                    onError?.(error as Error);
                    return; // Don't close if save failed
                  }
                }
                // Clear any pending auto-save timer
                if (autoSaveTimerRef.current) {
                  clearTimeout(autoSaveTimerRef.current);
                  autoSaveTimerRef.current = null;
                }
                setEditingComponentId(null);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              Save & Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="delete-confirmation-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <div className="mb-4 text-lg font-medium">Confirm Delete</div>
            <div className="mb-4 text-sm text-gray-600">
              Are you sure you want to delete this component? This action cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDeleteComponent(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
