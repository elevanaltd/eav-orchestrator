/**
 * Script Component Management Tests
 * TRACED Protocol: T (RED) - This test MUST fail first
 * Testing component CRUD operations that don't exist yet
 */

// Context7: consulted for vitest
import { describe, it, expect, vi } from 'vitest';
// Context7: consulted for @testing-library/react
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScriptEditor } from '../../../src/components/editor/ScriptEditor';
import type { ScriptComponent } from '../../../src/types/scriptComponent';

describe('Script Component Management - V2 Requirements', () => {
  // Test setup helper - not weakening tests, just providing required props
  const setup = (props = {}) => {
    const defaultProps = {
      config: { userName: 'test-user', userId: 'user-123' },
      components: [],
      onComponentAdd: vi.fn(),
      onComponentUpdate: vi.fn(),
      onComponentDelete: vi.fn(),
      onComponentReorder: vi.fn(),
      ...props
    };
    return render(<ScriptEditor {...defaultProps} />);
  };

  describe('Component Creation', () => {
    it('should create a new component when Add Component button is clicked', async () => {
      // RED STATE: This test MUST fail - Add Component button doesn't exist
      const mockOnComponentAdd = vi.fn().mockResolvedValue({
        component_id: 'comp-123',
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [] },
        content_plain: '',
        position: 1.0,
        component_type: 'main',
        component_status: 'created',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_edited_by: 'user-123',
        last_edited_at: new Date().toISOString()
      } as ScriptComponent);

      setup({ onComponentAdd: mockOnComponentAdd });

      // This will fail - button doesn't exist
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
      // RED STATE: Component list UI doesn't exist
      const mockComponents: ScriptComponent[] = [
        {
          component_id: 'comp-1',
          script_id: 'script-456',
          content_tiptap: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Introduction' }] }] },
          content_plain: 'Introduction',
          position: 1.0,
        component_type: 'main',          component_status: 'created',
          version: 1,
          created_at: '2025-01-15T00:00:00Z',
          updated_at: '2025-01-15T00:00:00Z',
          last_edited_by: 'user-123',
          last_edited_at: '2025-01-15T00:00:00Z'
        },
        {
          component_id: 'comp-2',
          script_id: 'script-456',
          content_tiptap: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Operations' }] }] },
          content_plain: 'Operations',
          position: 2.0,
        component_type: 'main',          component_status: 'created',
          version: 1,
          created_at: '2025-01-15T00:00:00Z',
          updated_at: '2025-01-15T00:00:00Z',
          last_edited_by: 'user-123',
          last_edited_at: '2025-01-15T00:00:00Z'
        },
        {
          component_id: 'comp-3',
          script_id: 'script-456',
          content_tiptap: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Maintenance' }] }] },
          content_plain: 'Maintenance',
          position: 3.0,
        component_type: 'main',          component_status: 'created',
          version: 1,
          created_at: '2025-01-15T00:00:00Z',
          updated_at: '2025-01-15T00:00:00Z',
          last_edited_by: 'user-123',
          last_edited_at: '2025-01-15T00:00:00Z'
        }
      ];

      setup({ components: mockComponents });

      // These will fail - component list doesn't exist
      expect(screen.getByTestId('component-list')).toBeInTheDocument();
      expect(screen.getByTestId('component-comp-1')).toBeInTheDocument();
      expect(screen.getByTestId('component-comp-2')).toBeInTheDocument();
      expect(screen.getByTestId('component-comp-3')).toBeInTheDocument();

      // Verify component count display
      expect(screen.getByText('3 of 18 components')).toBeInTheDocument();
    });

    it('should allow editing a component when clicked', async () => {
      // RED STATE: Component editing doesn't exist
      const mockOnComponentUpdate = vi.fn();
      const mockComponent: ScriptComponent = {
        component_id: 'comp-1',
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content' }] }] },
        content_plain: 'Original content',
        position: 1.0,
        component_type: 'main',
        component_status: 'created',
        version: 1,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
        last_edited_by: 'user-123',
        last_edited_at: '2025-01-15T00:00:00Z'
      };

      setup({
        components: [mockComponent],
        onComponentUpdate: mockOnComponentUpdate
      });

      // Click on component to edit
      const component = screen.getByTestId('component-comp-1');
      fireEvent.click(component);

      // Verify editor opens with component content
      await waitFor(() => {
        expect(screen.getByTestId('component-editor-comp-1')).toBeInTheDocument();
      });
    });

    it('should delete a component when delete button is clicked', async () => {
      // RED STATE: Delete functionality doesn't exist
      const mockOnComponentDelete = vi.fn();
      const mockComponent: ScriptComponent = {
        component_id: 'comp-1',
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [] },
        content_plain: '',
        position: 1.0,
        component_type: 'main',
        component_status: 'created',
        version: 1,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
        last_edited_by: 'user-123',
        last_edited_at: '2025-01-15T00:00:00Z'
      };

      setup({
        components: [mockComponent],
        onComponentDelete: mockOnComponentDelete
      });

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
      // RED STATE: Drag-drop doesn't exist
      const mockOnComponentReorder = vi.fn();
      const mockComponents: ScriptComponent[] = [
        {
          component_id: 'comp-1',
          script_id: 'script-456',
          content_tiptap: { type: 'doc', content: [] },
          content_plain: 'Component 1',
          position: 1.0,
        component_type: 'main',          component_status: 'created',
          version: 1,
          created_at: '2025-01-15T00:00:00Z',
          updated_at: '2025-01-15T00:00:00Z',
          last_edited_by: 'user-123',
          last_edited_at: '2025-01-15T00:00:00Z'
        },
        {
          component_id: 'comp-2',
          script_id: 'script-456',
          content_tiptap: { type: 'doc', content: [] },
          content_plain: 'Component 2',
          position: 2.0,
        component_type: 'main',          component_status: 'created',
          version: 1,
          created_at: '2025-01-15T00:00:00Z',
          updated_at: '2025-01-15T00:00:00Z',
          last_edited_by: 'user-123',
          last_edited_at: '2025-01-15T00:00:00Z'
        }
      ];

      setup({
        components: mockComponents,
        onComponentReorder: mockOnComponentReorder
      });

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
      // RED STATE: Component limit enforcement doesn't exist
      const mockComponents = Array.from({ length: 18 }, (_, i) => ({
        component_id: `comp-${i + 1}`,
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [] },
        content_plain: `Component ${i + 1}`,
        position: i + 1,
        component_type: 'main',
        component_status: 'created' as const,
        version: 1,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
        last_edited_by: 'user-123',
        last_edited_at: '2025-01-15T00:00:00Z'
      }));

      setup({ components: mockComponents });

      // Add button should be disabled when at limit
      const addButton = screen.getByRole('button', { name: /add component/i });
      expect(addButton).toBeDisabled();

      // Should show limit message
      expect(screen.getByText('18 of 18 components (maximum reached)')).toBeInTheDocument();
    });
  });

  describe('Component Performance Requirements', () => {
    it('should auto-save component changes within 1 second', async () => {
      // RED STATE: Auto-save doesn't exist
      vi.useFakeTimers();
      const mockOnComponentUpdate = vi.fn();

      const mockComponent: ScriptComponent = {
        component_id: 'comp-1',
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [] },
        content_plain: '',
        position: 1.0,
        component_type: 'main',
        component_status: 'created',
        version: 1,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
        last_edited_by: 'user-123',
        last_edited_at: '2025-01-15T00:00:00Z'
      };

      setup({
        components: [mockComponent],
        onComponentUpdate: mockOnComponentUpdate
      });

      // Edit component
      const component = screen.getByTestId('component-comp-1');
      fireEvent.click(component);

      // Type in editor
      const editor = screen.getByTestId('component-editor-comp-1');
      fireEvent.input(editor, { target: { textContent: 'New content' } });

      // Advance timers by 1 second
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockOnComponentUpdate).toHaveBeenCalledWith(
          'comp-1',
          expect.objectContaining({
            content_plain: expect.stringContaining('New content')
          })
        );
      });

      vi.useRealTimers();
    });
  });
});