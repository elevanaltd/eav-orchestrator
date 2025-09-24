/**
 * SIMPLIFIED POC: Paragraph-Based Component System
 *
 * Each paragraph is automatically a component
 * Clean copy/paste with visual indicators only
 */

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// ============================================
// PARAGRAPH COMPONENT TRACKER
// ============================================

/**
 * Extension that tracks paragraphs as components
 * and adds visual indicators without affecting content
 */
const ParagraphComponentTracker = Extension.create({
  name: 'paragraphComponentTracker',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let componentNumber = 0;

            // Iterate through the document
            state.doc.forEach((node, offset) => {
              // Each paragraph becomes a component
              if (node.type.name === 'paragraph' && node.content.size > 0) {
                componentNumber++;

                // Add a widget decoration for the component label
                const widget = Decoration.widget(offset, () => {
                  const label = document.createElement('div');
                  label.className = 'component-label';
                  label.setAttribute('data-component', `C${componentNumber}`);
                  label.textContent = `C${componentNumber}`;
                  label.style.cssText = `
                    position: absolute;
                    left: -50px;
                    background: #6B7280;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    user-select: none;
                    pointer-events: none;
                  `;
                  return label;
                }, {
                  side: -1,
                  marks: []
                });

                decorations.push(widget);
              }
            });

            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});

// ============================================
// REACT COMPONENT
// ============================================

export const ParagraphComponentsPOC: React.FC = () => {
  const [componentCount, setComponentCount] = useState(0);
  const [extractedComponents, setExtractedComponents] = useState<any[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'component-paragraph'
          }
        }
      }),
      ParagraphComponentTracker
    ],
    content: `
      <h2>MVHR System - Homeowner Guide</h2>
      <p>This comprehensive guide will walk you through the operation and maintenance of your Mechanical Ventilation Heat Recovery system.</p>
      <p>Effective ventilation is essential for a healthy home — and can help prevent problems such as condensation and mould. Your home's mechanical ventilation heat recovery system, or MVHR, is located in the utility cupboard and works by extracting stale air from wet rooms like bathrooms and kitchens, while bringing in fresh air from outside.</p>
      <p>The top two filters are supplied on your MVHR and will filter your outgoing and incoming air, but there's a third filter slot that's initially empty. This additional filter can be purchased separately and provides extra filtration for incoming air.</p>
      <p>Bear in mind that filters on your MVHR will collect dirt and debris and over time will become much less effective. Regular maintenance is essential to ensure optimal performance.</p>
    `,
    onUpdate: ({ editor }) => {
      extractComponents(editor);
    },
    onCreate: ({ editor }) => {
      extractComponents(editor);
    }
  });

  const extractComponents = (editor: any) => {
    const components: any[] = [];
    let componentNum = 0;

    editor.state.doc.forEach((node: any, offset: number) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentNum++;
        components.push({
          number: componentNum,
          content: node.textContent,
          wordCount: node.textContent.split(/\s+/).filter(Boolean).length,
          hash: generateHash(node.textContent)
        });
      }
    });

    setComponentCount(componentNum);
    setExtractedComponents(components);
  };

  const generateHash = (text: string): string => {
    return text.length.toString(36) + text.charCodeAt(0).toString(36);
  };

  const testCopy = () => {
    if (!editor) return;

    // Select all content
    editor.commands.selectAll();
    document.execCommand('copy');
    editor.commands.setTextSelection(0);

    alert('Content copied! Paste it anywhere to see clean text without component labels.');
  };

  return (
    <div className="poc-container">
      <style>{`
        .poc-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .header {
          margin-bottom: 30px;
        }

        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
          color: #1a1a1a;
        }

        .header p {
          color: #666;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
        }

        .panel {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .panel-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e5e5;
        }

        /* Editor Styles */
        .editor-wrapper {
          position: relative;
          padding-left: 60px;
          min-height: 400px;
        }

        .ProseMirror {
          min-height: 400px;
          outline: none;
          font-size: 16px;
          line-height: 1.6;
          color: #333;
        }

        .ProseMirror h2 {
          font-size: 24px;
          margin-bottom: 15px;
          color: #1a1a1a;
        }

        .ProseMirror p {
          margin-bottom: 15px;
          position: relative;
        }

        /* Component labels - positioned in margin */
        .component-label {
          position: absolute !important;
          left: -50px !important;
          top: 2px;
          background: #6B7280;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          user-select: none;
          pointer-events: none;
          z-index: 10;
        }

        /* Component list */
        .component-item {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          margin-bottom: 10px;
          border-left: 3px solid #6B7280;
        }

        .component-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .component-number {
          font-weight: 600;
          color: #1a1a1a;
        }

        .component-stats {
          font-size: 12px;
          color: #666;
        }

        .component-content {
          font-size: 14px;
          color: #666;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .test-button {
          background: #3B82F6;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          margin-bottom: 15px;
        }

        .test-button:hover {
          background: #2563EB;
        }

        .info-box {
          background: #EFF6FF;
          border-left: 4px solid #3B82F6;
          padding: 12px;
          border-radius: 4px;
          margin-top: 15px;
        }

        .info-box strong {
          color: #1E40AF;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 30px;
        }

        .benefit-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .benefit-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }

        .benefit-title {
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .benefit-text {
          font-size: 14px;
          color: #666;
          line-height: 1.5;
        }
      `}</style>

      <div className="header">
        <h1>📝 Simplified: Paragraph = Component</h1>
        <p>Each paragraph automatically becomes a component. Press Enter to create a new component.</p>
      </div>

      <div className="demo-grid">
        <div className="panel">
          <h2 className="panel-title">Editor (Single TipTap Instance)</h2>

          <div className="editor-wrapper">
            <EditorContent editor={editor} />
          </div>

          <button className="test-button" onClick={testCopy}>
            Test Copy (Component labels won't be copied)
          </button>

          <div className="info-box">
            <strong>How it works:</strong> Type and press Enter to create new components.
            Each paragraph is automatically tracked as a component with a C# label.
            Labels are visual only and don't appear in copied text.
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Extracted Components ({componentCount})</h2>

          {extractedComponents.map((comp) => (
            <div key={comp.number} className="component-item">
              <div className="component-header">
                <span className="component-number">Component {comp.number}</span>
                <span className="component-stats">{comp.wordCount} words</span>
              </div>
              <div className="component-content">
                {comp.content}
              </div>
              <div className="component-stats" style={{ marginTop: '5px' }}>
                Hash: {comp.hash}
              </div>
            </div>
          ))}

          <div className="info-box">
            <strong>1:1 Mapping:</strong> Each component can be individually sent for voice generation, scene planning, etc.
          </div>
        </div>
      </div>

      <div className="benefits-grid">
        <div className="benefit-card">
          <div className="benefit-icon">✨</div>
          <div className="benefit-title">Simple & Intuitive</div>
          <div className="benefit-text">
            Just type and press Enter. Each paragraph is automatically a component.
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon">📋</div>
          <div className="benefit-title">Clean Copy/Paste</div>
          <div className="benefit-text">
            Component labels are visual only. Copy text anywhere without labels.
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon">🎯</div>
          <div className="benefit-title">Perfect Alignment</div>
          <div className="benefit-text">
            C1, C2, C3 labels align perfectly with each paragraph in the margin.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParagraphComponentsPOC;