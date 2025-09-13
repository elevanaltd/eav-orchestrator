// Context7: consulted for react
import { useState } from 'react';
import { ScriptEditor } from './components/editor/ScriptEditor';
import type { EditorJSONContent } from './types/editor';

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

// Mock data for script list
const mockScripts = [
  { id: '1', title: 'MVHR System', wordCount: 2100, duration: '14:00', status: 'In editing', lastEdited: '2h ago' },
  { id: '2', title: 'Dishwasher - Bosch SMS25AW00G', wordCount: 1850, duration: '12:20', status: 'Client review', lastEdited: '5h ago' },
  { id: '3', title: 'Washing Machine - Samsung WW90T534', wordCount: 2300, duration: '15:20', status: 'Draft', lastEdited: '1d ago' }
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('script');
  const [selectedScript, setSelectedScript] = useState(mockScripts[0]);

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
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockScripts.map(script => (
                <div
                  key={script.id}
                  onClick={() => setSelectedScript(script)}
                  style={{
                    padding: '12px',
                    background: selectedScript.id === script.id ? '#f0f9ff' : '#f8fafc',
                    border: selectedScript.id === script.id ? `2px solid ${theme.blue}` : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: '4px', color: theme.dark }}>
                    {script.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {script.wordCount} words • {script.duration} • {script.status}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Last edited: {script.lastEdited}
                  </div>
                </div>
              ))}
            </div>
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
                  Word count: {selectedScript.wordCount} • Est. runtime: {selectedScript.duration}
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
                <ScriptEditor
                  config={{
                    documentId: selectedScript.id,
                    userId: 'demo-user',
                    userName: 'Demo User',
                    autoSave: true,
                    autoSaveDelay: 1000
                  }}
                  onContentChange={(content: EditorJSONContent) => {
                    console.log('Content changed:', content);
                  }}
                  onSave={async (content: EditorJSONContent) => {
                    console.log('Saving content:', content);
                  }}
                />
              </div>
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

export default App;