// TESTGUARD-APPROVED: Creating separate mock file to fix TipTap extension API structure
import { vi } from 'vitest';

// Proper mock structure for TipTap extensions
export const createExtensionMock = (name: string) => {
  const mockExtension = vi.fn(() => ({ name })) as any;
  mockExtension.configure = vi.fn(() => ({ name }));
  return mockExtension;
};

// Export configured mocks
export const CollaborationMock = createExtensionMock('Collaboration');
export const CollaborationCursorMock = createExtensionMock('CollaborationCursor');
