// Context7: consulted for react
// Context7: consulted for @sentry/react
import { useState, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { ScriptEditor } from './components/editor/ScriptEditor';
import type { EditorJSONContent, VideoScript, ScriptComponent } from './types/editor';
import { toUIModel } from './types/editor';
import type { ScriptComponentUI } from './types/editor';
import { ScriptComponentManager } from './lib/database/scriptComponentManager';
import { getSupabase } from './lib/supabase';
import { useClientLifecycle } from './hooks/useClientLifecycle';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';
import { UserMenu } from './components/auth/UserMenu';

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

// Mock project data - will be replaced with SmartSuite integration
interface ProjectInfo {
  eavCode: string;      // e.g., "EAV023"
  projectTitle: string; // e.g., "Berkeley Homes"
  clientName?: string;  // e.g., "Berkeley Construction"
  projectPhase?: string; // e.g., "Production"
}

const mockProjectData: ProjectInfo = {
  eavCode: 'EAV023',
  projectTitle: 'Berkeley Homes',
  clientName: 'Berkeley Construction',
  projectPhase: 'Production'
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

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('script');
  const [scripts, setScripts] = useState<VideoScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<VideoScript | null>(null);
  const [components, setComponents] = useState<ScriptComponent[]>([]);
  const [isLoadingScripts, setIsLoadingScripts] = useState(true);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Client lifecycle management for version coordination and resilience
  const { state: lifecycleState, checkConnection, forceRefresh } = useClientLifecycle({
    currentVersion: '1.0.0', // This should come from package.json in production
    versionEndpoint: '/api/version'
  });

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

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading EAV Orchestrator...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Component management handlers
  const handleComponentAdd = async (component: Partial<ScriptComponentUI>): Promise<ScriptComponentUI> => {
    if (!selectedScript) {
      throw new Error('No script selected');
    }

    try {
      // Convert UI model to API model for database operations
      const apiComponent: Partial<ScriptComponent> = {
        script_id: component.scriptId || selectedScript.id,
        content_tiptap: component.content || { type: 'doc', content: [] },
        content_plain: component.plainText || '',
        position: component.position,
        component_status: component.status || 'created'
      };

      // Use authenticated user ID for component creation
      const userId = user.id;

      const result = await componentManager.createComponent(
        apiComponent.script_id!,
        apiComponent.content_tiptap,
        apiComponent.content_plain,
        userId,
        apiComponent.position,
        apiComponent.component_status
      );

      // Update local state with optimistic update (database result is ScriptComponent)
      setComponents(prev => [...prev, result]);

      // Return UI model
      return toUIModel(result);
    } catch (error) {
      console.error('Failed to create component:', error);
      throw error;
    }
  };

  const handleComponentUpdate = async (componentId: string, updates: Partial<ScriptComponentUI>): Promise<void> => {
    if (!selectedScript) {
      throw new Error('No script selected');
    }

    try {
      // Find the current component to get its version
      const currentComponent = components.find(c => c.component_id === componentId);
      if (!currentComponent) {
        throw new Error('Component not found');
      }

      // Convert UI updates to API format
      const apiUpdates: { content?: object; plainText?: string } = {};
      if (updates.content) {
        apiUpdates.content = updates.content;
      }
      if (updates.plainText !== undefined) {
        apiUpdates.plainText = updates.plainText;
      }

      // Use authenticated user ID for component update
      const userId = user.id;

      const result = await componentManager.updateComponent(
        componentId,
        apiUpdates.content || currentComponent.content_tiptap,
        apiUpdates.plainText || currentComponent.content_plain,
        currentComponent.version,
        userId
      );

      // Update local state with optimistic update
      setComponents(prev => prev.map(comp =>
        comp.component_id === componentId
          ? {
              ...comp,
              content_tiptap: apiUpdates.content || comp.content_tiptap,
              content_plain: apiUpdates.plainText || comp.content_plain,
              version: result.newVersion || comp.version,
              updated_at: new Date().toISOString()
            }
          : comp
      ));
    } catch (error) {
      console.error('Failed to update component:', error);
      throw error;
    }
  };

  const handleComponentDelete = async (componentId: string): Promise<void> => {
    if (!selectedScript) {
      throw new Error('No script selected');
    }

    try {
      // Here we would call a delete method on the component manager
      // For now, just remove from local state (soft delete)
      setComponents(prev => prev.filter(comp => comp.component_id !== componentId));
    } catch (error) {
      console.error('Failed to delete component:', error);
      throw error;
    }
  };

  const handleComponentReorder = async (componentIds: string[]): Promise<void> => {
    if (!selectedScript) {
      throw new Error('No script selected');
    }

    try {
      // Update positions based on new order
      const reorderedComponents = componentIds.map((id, index) => {
        const component = components.find(c => c.component_id === id);
        return component ? { ...component, position: (index + 1) * 1000.0 } : null;
      }).filter(Boolean) as ScriptComponent[];

      // Here we would call a reorder method on the component manager
      // For now, just update local state
      setComponents(reorderedComponents);
    } catch (error) {
      console.error('Failed to reorder components:', error);
      throw error;
    }
  };

  // Status banner helper function
  const renderStatusBanner = () => {
    if (lifecycleState === 'HEALTHY' || lifecycleState === 'INITIALIZING') {
      return null; // Don't show banner for normal states
    }

    const getBannerConfig = () => {
      switch (lifecycleState) {
        case 'OFFLINE':
          return {
            background: '#fef3c7',
            border: '#fbbf24',
            textColor: '#92400e',
            icon: '⚠️',
            title: 'Connection Lost',
            message: 'Unable to connect to server. Changes are being saved locally.',
            action: (
              <button
                onClick={checkConnection}
                style={{
                  padding: '6px 12px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Retry Connection
              </button>
            )
          };
        case 'SYNCING':
          return {
            background: '#dbeafe',
            border: '#3b82f6',
            textColor: '#1e40af',
            icon: '🔄',
            title: 'Syncing',
            message: 'Reconnecting and syncing your changes...',
            action: null
          };
        case 'UPDATE_REQUIRED':
          return {
            background: '#fecaca',
            border: '#ef4444',
            textColor: '#dc2626',
            icon: '⚡',
            title: 'Update Required',
            message: 'A new version is available. Please refresh to continue.',
            action: (
              <button
                onClick={forceRefresh}
                style={{
                  padding: '6px 12px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Refresh Now
              </button>
            )
          };
        default:
          return null;
      }
    };

    const config = getBannerConfig();
    if (!config) return null;

    return (
      <div style={{
        background: config.background,
        border: `1px solid ${config.border}`,
        borderLeft: `4px solid ${config.border}`,
        padding: '12px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px' }}>{config.icon}</span>
          <div>
            <span style={{ fontWeight: '500', color: config.textColor, marginRight: '8px' }}>
              {config.title}:
            </span>
            <span style={{ color: config.textColor, fontSize: '14px' }}>
              {config.message}
            </span>
          </div>
        </div>
        {config.action}
      </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>
              EAV Orchestrator
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>
              Collaborative Video Production System - V2-V8 Workflows
            </p>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* Client Lifecycle Status Banner */}
      {renderStatusBanner()}

      {/* Project Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 30px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Project Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: `linear-gradient(135deg, ${theme.red} 0%, ${theme.midDark} 100%)`,
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 8px rgba(212, 14, 67, 0.2)'
            }}>
              {mockProjectData.eavCode}
            </div>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: theme.dark,
                margin: '0 0 4px 0',
                lineHeight: '1.2'
              }}>
                {mockProjectData.projectTitle}
              </h2>
              {mockProjectData.clientName && (
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Client: {mockProjectData.clientName}
                </p>
              )}
            </div>
          </div>

          {/* Project Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {mockProjectData.projectPhase && (
              <div style={{
                background: theme.green,
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(77, 176, 83, 0.2)'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '50%',
                  display: 'inline-block'
                }} />
                {mockProjectData.projectPhase}
              </div>
            )}
            <div style={{
              fontSize: '12px',
              color: '#94a3b8',
              textAlign: 'right',
              fontWeight: '500'
            }}>
              <div>Script Editor v2.1</div>
              <div>Real-time Collaboration</div>
            </div>
          </div>
        </div>
      </div>

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
          height: 'calc(100vh - 220px)', // Adjusted for header (72px) + project header (64px) + tabs (52px) + padding
          background: theme.light
        }}>
          {/* Left Sidebar - Script List */}
          <div style={{
            width: '250px', // Reduced from 300px as requested
            background: 'white',
            borderRight: '1px solid #e2e8f0',
            padding: '24px',
            overflowY: 'auto',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)'
          }}>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              marginBottom: '20px',
              color: theme.dark 
            }}>
              Project Scripts
            </h3>
            
            {/* Loading State - Skeleton */}
            {isLoadingScripts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[1, 2, 3].map(index => (
                  <div key={index} style={{
                    padding: '16px',
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                  }}>
                    {/* Title skeleton */}
                    <div style={{
                      height: '20px',
                      background: '#f1f5f9',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      width: `${70 + (index * 10)}%`,
                      animation: 'pulse 1.5s ease-in-out infinite alternate',
                      backgroundImage: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
                      backgroundSize: '200% 100%',
                      backgroundPosition: '0% 0%'
                    }} />
                    {/* Meta info skeleton */}
                    <div style={{
                      height: '14px',
                      background: '#f8fafc',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      width: '60%',
                      animation: 'pulse 1.5s ease-in-out infinite alternate 0.3s'
                    }} />
                    {/* Date skeleton */}
                    <div style={{
                      height: '12px',
                      background: '#f8fafc',
                      borderRadius: '4px',
                      width: '40%',
                      animation: 'pulse 1.5s ease-in-out infinite alternate 0.6s'
                    }} />
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {scriptError && (
              <div style={{
                padding: '20px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderLeft: '4px solid #ef4444',
                borderRadius: '12px',
                color: '#dc2626',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>
                    Failed to load scripts
                  </div>
                </div>
                <div style={{ lineHeight: '1.4', color: '#991b1b' }}>
                  {scriptError}
                </div>
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
                <button
                  onClick={async () => {
                    setIsLoadingScripts(true);
                    setScriptError(null);

                    try {
                      // ERROR-ARCHITECT-APPROVED: ERROR-ARCHITECT-20250919-ab85cf3d
                      // Get the system default video ID (runtime discovery pattern)
                      const defaultResult = await componentManager.getDefaultVideoId();

                      if (defaultResult.error || !defaultResult.videoId) {
                        throw new Error(defaultResult.error || 'No default video available');
                      }

                      // Create a new script in the database using the default video
                      const result = await componentManager.createScript(
                        defaultResult.videoId,
                        'New Script',
                        'A new video script (uncategorized)'
                      );

                      if (result.error || !result.script) {
                        throw new Error(result.error || 'Failed to create script');
                      }

                      // Transform to UI model
                      const newScript: VideoScript = {
                        id: result.script.script_id,
                        videoId: result.script.video_id,
                        title: result.script.title,
                        description: result.script.description,
                        wordCount: 0,
                        duration: '0',
                        status: result.script.script_status as VideoScript['status'],
                        lastEdited: result.script.updated_at,
                        createdAt: result.script.created_at,
                        updatedAt: result.script.updated_at,
                        lastEditedBy: result.script.last_edited_by
                      };

                      // Add to local state and select it
                      setScripts([newScript]);
                      setSelectedScript(newScript);
                    } catch (error) {
                      console.error('Failed to create script:', error);
                      setScriptError(error instanceof Error ? error.message : 'Failed to create script');
                    } finally {
                      setIsLoadingScripts(false);
                    }
                  }}
                  style={{
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {scripts.map(script => (
                  <div
                    key={script.id}
                    onClick={() => setSelectedScript(script)}
                    style={{
                      padding: '16px',
                      background: selectedScript?.id === script.id ? '#f0f9ff' : 'white',
                      border: selectedScript?.id === script.id ? `2px solid ${theme.blue}` : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: selectedScript?.id === script.id
                        ? '0 8px 25px rgba(59, 130, 246, 0.15)'
                        : '0 2px 8px rgba(0, 0, 0, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedScript?.id !== script.id) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedScript?.id !== script.id) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                      }
                    }}
                  >
                    <div style={{
                      fontWeight: '600',
                      marginBottom: '8px',
                      color: theme.dark,
                      fontSize: '15px',
                      lineHeight: '1.4'
                    }}>
                      {script.title}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      marginBottom: '8px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <span>{script.wordCount ? `${script.wordCount} words` : 'No content'}</span>
                      <span>•</span>
                      <span>{script.duration || 'No duration'}</span>
                      <span>•</span>
                      <span style={{
                        background: script.status === 'draft' ? '#dbeafe' :
                                  script.status === 'in_editing' ? '#fef3c7' :
                                  script.status === 'client_review' ? '#fdf2f8' : '#dcfce7',
                        color: script.status === 'draft' ? '#1e40af' :
                               script.status === 'in_editing' ? '#92400e' :
                               script.status === 'client_review' ? '#be185d' : '#166534',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {script.status}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      fontWeight: '400'
                    }}>
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
            padding: '20px',
            overflowY: 'auto',
            borderRight: '1px solid #e2e8f0'
          }}>
            <div style={{
              maxWidth: '1200px',
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Editor skeleton */}
                        <div style={{
                          height: '40px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          border: '1px solid #e2e8f0'
                        }} />
                        {/* Content skeleton */}
                        {[1, 2, 3, 4].map(index => (
                          <div key={index} style={{
                            height: '16px',
                            background: '#f8fafc',
                            borderRadius: '4px',
                            width: `${60 + (index % 3) * 15}%`,
                            animation: `pulse 1.5s ease-in-out infinite alternate ${index * 0.2}s`
                          }} />
                        ))}
                        <div style={{
                          height: '100px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          marginTop: '20px',
                          border: '1px solid #e2e8f0'
                        }} />
                      </div>
                    ) : (
                      <ScriptEditor
                        config={{
                          projectId: 'eav-orchestrator-main', // Required for collaboration
                          documentId: selectedScript.id,
                          scriptId: selectedScript.id, // Add scriptId for component creation
                          userId: user.id, // Authenticated user
                          userName: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                          autoSave: true,
                          autoSaveDelay: 1000
                        }}
                        components={components.map(toUIModel)}
                        onContentChange={(content: EditorJSONContent) => {
                          console.log('Content changed:', content);
                        }}
                        onComponentAdd={handleComponentAdd}
                        onComponentUpdate={handleComponentUpdate}
                        onComponentDelete={handleComponentDelete}
                        onComponentReorder={handleComponentReorder}
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
            width: '300px', // Reduced from 350px as requested
            background: 'white',
            padding: '24px',
            overflowY: 'auto',
            boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)'
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
              padding: '18px',
              background: 'white',
              borderRadius: '12px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: theme.red,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  S
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.dark
                }}>
                  Sarah (Client)
                </div>
              </div>
              <div style={{
                fontSize: '14px',
                color: '#475569',
                marginBottom: '12px',
                lineHeight: '1.5'
              }}>
                Can we add more detail about the filter replacement schedule?
              </div>
              <div style={{
                fontSize: '12px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>2 hours ago</span>
                <span>•</span>
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  Section 2
                </span>
              </div>
            </div>

            <div style={{
              padding: '18px',
              background: 'white',
              borderRadius: '12px',
              marginBottom: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.2s ease'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: theme.green,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  J
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.dark
                }}>
                  John (Editor)
                </div>
              </div>
              <div style={{
                fontSize: '14px',
                color: '#475569',
                marginBottom: '12px',
                lineHeight: '1.5'
              }}>
                Added the maintenance schedule as requested. Please review.
              </div>
              <div style={{
                fontSize: '12px',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>1 hour ago</span>
                <span>•</span>
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  Section 2
                </span>
              </div>
            </div>

            {/* Add Comment Box */}
            <div style={{
              marginTop: '24px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}>
              <textarea
                placeholder="Add a comment..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.blue;
                  e.target.style.boxShadow = `0 0 0 3px rgba(59, 130, 246, 0.1)`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: theme.blue,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.blue;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              }}
              >
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
          height: 'calc(100vh - 220px)',
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

// Main App component with Authentication Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

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