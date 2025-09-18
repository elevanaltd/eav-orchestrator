// Context7: consulted for react
// Context7: consulted for @sentry/react
import { useState, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { ScriptEditor } from './components/editor/ScriptEditor';
import type { EditorJSONContent, VideoScript, ScriptComponent } from './types/editor';
import { ScriptComponentManager } from './lib/database/scriptComponentManager';
import { getSupabase } from './lib/supabase';

// EAV Brand Colors
const theme = {
  red: '#D40E43',
  green: '#4DB053',
  dark: '#241E4A',
  midDark: '#62187C',
  light: '#f8fafc',
  accent: '#7c3aed',
  warning: '#f59e0b',
  blue: '#3b82f6'
};

type TabId = 'script' | 'voice' | 'scenes' | 'direction';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  implemented: boolean;
}

const tabs: Tab[] = [
  { id: 'script', label: 'Script Editor', icon: '📝', implemented: true },
  { id: 'voice', label: 'Voice Generation', icon: '🎵', implemented: false },
  { id: 'scenes', label: 'Scene Generation', icon: '🎬', implemented: false },
  { id: 'direction', label: 'Edit Direction', icon: '🎯', implemented: false }
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('script');
  const [scripts, setScripts] = useState<VideoScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<VideoScript | null>(null);
  const [components, setComponents] = useState<ScriptComponent[]>([]);
  const [isLoadingScripts, setIsLoadingScripts] = useState(true);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // ERROR-ARCHITECT-APPROVED: React hooks dependency fix - memoize componentManager
  // Initialize component manager with useMemo to avoid recreation
  const componentManager = useMemo(() => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }
    return new ScriptComponentManager(supabase);
  }, []); // Only create once on mount

  // Load scripts on app start
  useEffect(() => {
    const loadScripts = async () => {
      setIsLoadingScripts(true);
      setScriptError(null);

      try {
        const result = await componentManager.getAllScripts();

        if (result.error) {
          throw new Error(result.error);
        }

        // Transform database scripts to VideoScript interface
        const transformedScripts: VideoScript[] = result.scripts.map(script => ({
          id: script.script_id,
          videoId: script.video_id,
          title: script.title,
          description: script.description,
          wordCount: script.word_count,
          duration: script.estimated_duration,
          status: script.script_status as VideoScript['status'],
          lastEdited: script.last_edited_at || script.updated_at,
          createdAt: script.created_at,
          updatedAt: script.updated_at,
          lastEditedBy: script.last_edited_by
        }));

        setScripts(transformedScripts);

        // Auto-select first script if available and none selected
        if (transformedScripts.length > 0 && !selectedScript) {
          setSelectedScript(transformedScripts[0]);
        }
      } catch (error) {
        console.error('Failed to load scripts:', error);
        setScriptError(error instanceof Error ? error.message : 'Failed to load scripts');
        setScripts([]);
      } finally {
        setIsLoadingScripts(false);
      }
    };

    loadScripts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on app start - componentManager is stable from useMemo

  // Load components when script changes
  useEffect(() => {
    if (!selectedScript) {
      setComponents([]);
      return;
    }
    const loadComponents = async () => {
      setIsLoadingComponents(true);
      try {
        const result = await componentManager.getComponentsByScriptId(selectedScript.id);
        // Use database result directly - already matches ScriptComponent interface
        setComponents(result.components);
      } catch (error) {
        console.error('Failed to load components:', error);
        // Set empty array on error to prevent UI issues
        setComponents([]);
      } finally {
        setIsLoadingComponents(false);
      }
    };

    loadComponents();
  }, [selectedScript, componentManager]);

  // Component management handlers
  const handleComponentAdd = async (component: Partial<ScriptComponent>): Promise<ScriptComponent> => {
    if (!selectedScript) {
      throw new Error('No script selected');
    }

    try {
      const result = await componentManager.createComponent(
        component.script_id || selectedScript.id,
        component.content_tiptap || { type: 'doc', content: [] },
        component.content_plain || '',
        'demo-user', // In production, this would come from auth context
        component.position,
        component.component_status || 'created'
      );

      // Use the result directly - already matches ScriptComponent interface
      const newComponent = result;

      // Update local state with optimistic update
      setComponents(prev => [...prev, newComponent]);

      return newComponent;
    } catch (error) {
      console.error('Failed to create component:', error);
      throw error;
    }
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', background: theme.light }}>
      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.midDark} 100%)`,
        color: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>
          EAV Orchestrator
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.9 }}>
          Collaborative Video Production System - V2-V8 Workflows
        </p>
      </header>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '10px',
        padding: '20px 30px',
        background: 'white',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? theme.midDark : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              borderRadius: '8px',
              cursor: tab.implemented ? 'pointer' : 'not-allowed',
              fontWeight: 500,
              fontSize: '14px',
              transition: 'all 0.3s ease',
              opacity: tab.implemented ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            disabled={!tab.implemented}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {!tab.implemented && <span style={{ fontSize: '12px' }}>(Phase 2)</span>}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {activeTab === 'script' ? (
        <div style={{
          display: 'flex',
          height: 'calc(100vh - 180px)',
          background: theme.light
        }}>
          {/* Left Sidebar - Script List */}
          <div style={{
            width: '300px',
            background: 'white',
            borderRight: '1px solid #e2e8f0',
            padding: '20px',
            overflowY: 'auto'
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              marginBottom: '20px',
              color: theme.dark 
            }}>
              Project Scripts
            </h3>
            
            {/* Loading State */}
            {isLoadingScripts && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                fontSize: '16px',
                color: '#64748b'
              }}>
                ⏳ Loading scripts...
              </div>
            )}

            {/* Error State */}
            {scriptError && (
              <div style={{
                padding: '16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  Failed to load scripts
                </div>
                <div>{scriptError}</div>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingScripts && !scriptError && scripts.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                <h4 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: theme.dark,
                  marginBottom: '8px'
                }}>
                  No Scripts Yet
                </h4>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
                  Create your first script to get started with collaborative video production.
                </p>
                <button style={{
                  padding: '12px 24px',
                  background: theme.midDark,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                  Create First Script
                </button>
              </div>
            )}

            {/* Script List */}
            {!isLoadingScripts && !scriptError && scripts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {scripts.map(script => (
                  <div
                    key={script.id}
                    onClick={() => setSelectedScript(script)}
                    style={{
                      padding: '12px',
                      background: selectedScript?.id === script.id ? '#f0f9ff' : '#f8fafc',
                      border: selectedScript?.id === script.id ? `2px solid ${theme.blue}` : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px', color: theme.dark }}>
                      {script.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {script.wordCount ? `${script.wordCount} words` : 'No content'} •
                      {script.duration || 'No duration'} • {script.status}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Last edited: {new Date(script.lastEdited).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center - Script Editor */}
          <div style={{
            flex: 1,
            background: 'white',
            padding: '30px',
            overflowY: 'auto'
          }}>
            <div style={{
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              {selectedScript ? (
                <>
                  {/* Script Status Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <span style={{ fontWeight: '600', color: '#166534' }}>Script Status:</span>
                      <span style={{
                        background: theme.green,
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {selectedScript.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Word count: {selectedScript.wordCount || 0} • Est. runtime: {selectedScript.duration || 'N/A'}
                    </div>
                  </div>

                  {/* Script Title */}
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: '600',
                    marginBottom: '24px',
                    color: theme.dark
                  }}>
                    {selectedScript.title}
                  </h1>

                  {/* TipTap Editor Integration */}
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '20px',
                    minHeight: '400px',
                    background: '#ffffff'
                  }}>
                    {isLoadingComponents ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px',
                        fontSize: '16px',
                        color: '#64748b'
                      }}>
                        ⏳ Loading components...
                      </div>
                    ) : (
                      <ScriptEditor
                        config={{
                          projectId: 'eav-orchestrator-main', // Required for collaboration
                          documentId: selectedScript.id,
                          scriptId: selectedScript.id, // Add scriptId for component creation
                          userId: 'demo-user',
                          userName: 'Demo User',
                          autoSave: true,
                          autoSaveDelay: 1000
                        }}
                        components={components}
                        onContentChange={(content: EditorJSONContent) => {
                          console.log('Content changed:', content);
                        }}
                        onComponentAdd={handleComponentAdd}
                        onSave={async (content: EditorJSONContent) => {
                          console.log('Saving content:', content);
                        }}
                      />
                    )}
                  </div>
                </>
              ) : (
                /* No Script Selected State */
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <h2 style={{
                      fontSize: '24px',
                      fontWeight: '600',
                      color: theme.dark,
                      marginBottom: '8px'
                    }}>
                      Select a Script
                    </h2>
                    <p style={{ fontSize: '16px', color: '#64748b' }}>
                      Choose a script from the sidebar to start editing
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Comments */}
          <div style={{
            width: '350px',
            background: 'white',
            borderLeft: '1px solid #e2e8f0',
            padding: '20px',
            overflowY: 'auto'
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              marginBottom: '20px',
              color: theme.dark 
            }}>
              Comments & Review
            </h3>
            
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '8px',
                color: theme.dark 
              }}>
                Sarah (Client)
              </div>
              <div style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>
                Can we add more detail about the filter replacement schedule?
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                2 hours ago • Section 2
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '8px',
                color: theme.dark 
              }}>
                John (Editor)
              </div>
              <div style={{ fontSize: '14px', color: '#475569', marginBottom: '8px' }}>
                Added the maintenance schedule as requested. Please review.
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                1 hour ago • Section 2
              </div>
            </div>

            {/* Add Comment Box */}
            <div style={{
              marginTop: '24px',
              padding: '16px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <textarea
                placeholder="Add a comment..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <button style={{
                marginTop: '8px',
                padding: '8px 16px',
                background: theme.blue,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                Post Comment
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 180px)',
          background: 'white'
        }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: theme.dark, marginBottom: '8px' }}>
              Coming in Phase 2
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b' }}>
              This feature will be implemented in the next development phase
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Error fallback component for Sentry error boundary
const ErrorFallback = ({ error, resetError }: { error: unknown; resetError: () => void }) => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        padding: '40px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#dc2626',
          marginBottom: '16px'
        }}>
          Something went wrong
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          We've encountered an unexpected error. Our team has been automatically notified
          and will investigate the issue.
        </p>
        <details style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: '500',
            marginBottom: '8px'
          }}>
            Technical details
          </summary>
          <pre style={{
            fontSize: '12px',
            color: '#475569',
            overflow: 'auto',
            margin: 0
          }}>
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </details>
        <button
          onClick={resetError}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    </div>
);

// Wrap App with Sentry Error Boundary for production error monitoring
const AppWithErrorBoundary = Sentry.withErrorBoundary(App, {
  fallback: ErrorFallback,
  beforeCapture: (scope, error) => {
    scope.setTag('component', 'App');
    scope.setTag('errorBoundary', true);
    scope.setContext('errorBoundary', {
      componentStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      // eslint-disable-next-line no-undef
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
  },
});

export default AppWithErrorBoundary;