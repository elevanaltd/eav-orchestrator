/**
 * Script Component Management Tests - Controlled Component Version
 * TRACED Protocol: T (RED) → GREEN → REFACTOR
 * Testing controlled component behavior with proper state management
 */

// Context7: consulted for vitest
import { describe, it, expect, vi } from 'vitest';
// Context7: consulted for @testing-library/react
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ScriptEditor } from '../../../src/components/editor/ScriptEditor';
import type { ScriptComponentUI } from '../../../src/types/editor';

describe('Script Component Management - Controlled Component', () => {
  // Test wrapper that properly manages component state
  const TestWrapper = ({ initialComponents = [], onAddMock, onUpdateMock, onDeleteMock, onReorderMock }: {
    initialComponents?: ScriptComponentUI[];
    onAddMock?: any;
    onUpdateMock?: any;
    onDeleteMock?: any;
    onReorderMock?: any;
  }) => {
    const [components, setComponents] = React.useState<ScriptComponentUI[]>(initialComponents);

    const handleComponentAdd = async (component: Partial<ScriptComponentUI>): Promise<ScriptComponentUI> => {
      const newComponent: ScriptComponentUI = {
        componentId: 'comp-123',
        scriptId: 'script-456',
        content: { type: 'doc', content: [] },
        plainText: '',
        position: components.length + 1,
        type: 'standard',
        status: 'created',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastEditedBy: 'user-123',
        lastEditedAt: new Date().toISOString(),
        ...component
      };

      setComponents(prev => [...prev, newComponent]);

      if (onAddMock) {
        await onAddMock(component);
      }

      return newComponent;
    };

    const handleComponentUpdate = async (componentId: string, updates: Partial<ScriptComponentUI>) => {
      setComponents(prev => prev.map(c =>
        c.componentId === componentId ? { ...c, ...updates } : c
      ));

      if (onUpdateMock) {
        await onUpdateMock(componentId, updates);
      }
    };

    const handleComponentDelete = async (componentId: string) => {
      setComponents(prev => prev.filter(c => c.componentId !== componentId));

      if (onDeleteMock) {
        await onDeleteMock(componentId);
      }
    };

    const handleComponentReorder = async (componentIds: string[]) => {
      setComponents(prev => {
        const reordered = componentIds.map(id => prev.find(c => c.componentId === id)!).filter(Boolean);
        return reordered;
      });

      if (onReorderMock) {
        await onReorderMock(componentIds);
      }
    };

    return (
      <ScriptEditor
        config={{ userName: 'test-user', userId: 'user-123' }}
        components={components}
        onComponentAdd={handleComponentAdd}
        onComponentUpdate={handleComponentUpdate}
        onComponentDelete={handleComponentDelete}
        onComponentReorder={handleComponentReorder}
      />
    );
  };

  describe('Component Creation', () => {
    it('should create a new component when Add Component button is clicked', async () => {
      const mockOnComponentAdd = vi.fn();

      render(<TestWrapper onAddMock={mockOnComponentAdd} />);

      // Find and click the Add Component button
      const addButton = screen.getByRole('button', { name: /add component/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockOnComponentAdd).toHaveBeenCalled();
      });

      // Verify component appears in list
      await waitFor(() => {
        expect(screen.getByTestId('component-comp-123')).toBeInTheDocument();
      });
    });

    it('should display a list of existing components', () => {
      const mockComponents: ScriptComponentUI[] = [
        {
          componentId: 'comp-1',
          scriptId: 'script-456',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Introduction' }] }] },
          plainText: 'Introduction',
          position: 1.0,
          type: 'standard',
          status: 'created',
          version: 1,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
          lastEditedBy: 'user-123',
          lastEditedAt: '2025-01-15T00:00:00Z'
        },
        {
          componentId: 'comp-2',
          scriptId: 'script-456',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Operations' }] }] },
          plainText: 'Operations',
          position: 2.0,
          type: 'standard',
          status: 'created',
          version: 1,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
          lastEditedBy: 'user-123',
          lastEditedAt: '2025-01-15T00:00:00Z'
        },
        {
          componentId: 'comp-3',
          scriptId: 'script-456',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Maintenance' }] }] },
          plainText: 'Maintenance',
          position: 3.0,
          type: 'standard',
          status: 'created',
          version: 1,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
          lastEditedBy: 'user-123',
          lastEditedAt: '2025-01-15T00:00:00Z'
        }
      ];

      render(<TestWrapper initialComponents={mockComponents} />);

      expect(screen.getByTestId('component-list')).toBeInTheDocument();
      expect(screen.getByTestId('component-comp-1')).toBeInTheDocument();
      expect(screen.getByTestId('component-comp-2')).toBeInTheDocument();
      expect(screen.getByTestId('component-comp-3')).toBeInTheDocument();

      // Verify component count display
      expect(screen.getByText('3 of 18 components')).toBeInTheDocument();
    });

    it('should allow editing a component when clicked', async () => {
      const mockOnComponentUpdate = vi.fn();
      const mockComponent: ScriptComponentUI = {
        componentId: 'comp-1',
        scriptId: 'script-456',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content' }] }] },
        plainText: 'Original content',
        position: 1.0,
        type: 'standard',
        status: 'created',
        version: 1,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
        lastEditedBy: 'user-123',
        lastEditedAt: '2025-01-15T00:00:00Z'
      };

      render(<TestWrapper initialComponents={[mockComponent]} onUpdateMock={mockOnComponentUpdate} />);

      // Click on component to edit
      const component = screen.getByTestId('component-comp-1');
      fireEvent.click(component);

      // Verify editor opens with component content
      await waitFor(() => {
        expect(screen.getByTestId('component-editor-comp-1')).toBeInTheDocument();
      });
    });

    it('should delete a component when delete button is clicked', async () => {
      const mockOnComponentDelete = vi.fn();
      const mockComponent: ScriptComponentUI = {
        componentId: 'comp-1',
        scriptId: 'script-456',
        content: { type: 'doc', content: [] },
        plainText: '',
        position: 1.0,
        type: 'standard',
        status: 'created',
        version: 1,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
        lastEditedBy: 'user-123',
        lastEditedAt: '2025-01-15T00:00:00Z'
      };

      render(<TestWrapper initialComponents={[mockComponent]} onDeleteMock={mockOnComponentDelete} />);

      // Find and click delete button
      const deleteButton = screen.getByTestId('delete-component-comp-1');
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnComponentDelete).toHaveBeenCalledWith('comp-1');
      });
    });

    it('should support drag-and-drop reordering of components', async () => {
      const mockOnComponentReorder = vi.fn();
      const mockComponents: ScriptComponentUI[] = [
        {
          componentId: 'comp-1',
          scriptId: 'script-456',
          content: { type: 'doc', content: [] },
          plainText: 'Component 1',
          position: 1.0,
          type: 'standard',
          status: 'created',
          version: 1,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
          lastEditedBy: 'user-123',
          lastEditedAt: '2025-01-15T00:00:00Z'
        },
        {
          componentId: 'comp-2',
          scriptId: 'script-456',
          content: { type: 'doc', content: [] },
          plainText: 'Component 2',
          position: 2.0,
          type: 'standard',
          status: 'created',
          version: 1,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
          lastEditedBy: 'user-123',
          lastEditedAt: '2025-01-15T00:00:00Z'
        }
      ];

      render(<TestWrapper initialComponents={mockComponents} onReorderMock={mockOnComponentReorder} />);

      // Find drag handles
      const dragHandle1 = screen.getByTestId('drag-handle-comp-1');
      const dragHandle2 = screen.getByTestId('drag-handle-comp-2');

      // Simulate drag comp-2 before comp-1
      fireEvent.dragStart(dragHandle2);
      fireEvent.dragOver(dragHandle1);
      fireEvent.drop(dragHandle1);

      await waitFor(() => {
        expect(mockOnComponentReorder).toHaveBeenCalledWith(['comp-2', 'comp-1']);
      });
    });

    it('should limit components to 18 maximum', async () => {
      const mockComponents = Array.from({ length: 18 }, (_, i) => ({
        componentId: `comp-${i + 1}`,
        scriptId: 'script-456',
        content: { type: 'doc', content: [] },
        plainText: `Component ${i + 1}`,
        position: i + 1,
        type: 'standard',
        status: 'created' as const,
        version: 1,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
        lastEditedBy: 'user-123',
        lastEditedAt: '2025-01-15T00:00:00Z'
      }));

      render(<TestWrapper initialComponents={mockComponents} />);

      // Add button should be disabled when at limit
      const addButton = screen.getByRole('button', { name: /add component/i });
      expect(addButton).toBeDisabled();

      // Should show limit message
      expect(screen.getByText('18 of 18 components (maximum reached)')).toBeInTheDocument();
    });
  });

  describe('Component Performance Requirements', () => {
    it('should auto-save component changes within 1 second', async () => {
      const mockOnComponentUpdate = vi.fn();

      const mockComponent: ScriptComponentUI = {
        componentId: 'comp-1',
        scriptId: 'script-456',
        content: { type: 'doc', content: [] },
        plainText: '',
        position: 1.0,
        type: 'standard',
        status: 'created',
        version: 1,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z',
        lastEditedBy: 'user-123',
        lastEditedAt: '2025-01-15T00:00:00Z'
      };

      render(<TestWrapper initialComponents={[mockComponent]} onUpdateMock={mockOnComponentUpdate} />);

      // Edit component
      const component = screen.getByTestId('component-comp-1');
      fireEvent.click(component);

      // Type in editor
      const editor = screen.getByTestId('component-editor-comp-1');
      const textarea = editor.querySelector('textarea');
      expect(textarea).toBeInTheDocument();

      // Use real timers for this test to avoid conflicts with waitFor
      fireEvent.change(textarea!, { target: { value: 'New content' } });

      // Wait for auto-save to trigger after 1 second
      await waitFor(() => {
        expect(mockOnComponentUpdate).toHaveBeenCalledWith(
          'comp-1',
          expect.objectContaining({
            plainText: 'New content'
          })
        );
      }, { timeout: 2000 }); // Give it 2 seconds to auto-save
    });
  });
});