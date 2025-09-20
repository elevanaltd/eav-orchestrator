// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../../src/App';

describe('Project Header', () => {
  it('displays project code and title correctly', () => {
    render(<App />);

    // Check if project code is displayed
    expect(screen.getByText('EAV023')).toBeInTheDocument();

    // Check if project title is displayed
    expect(screen.getByText('Berkeley Homes')).toBeInTheDocument();
  });

  it('displays client information when available', () => {
    render(<App />);

    // Check if client name is displayed
    expect(screen.getByText('Client: Berkeley Construction')).toBeInTheDocument();
  });

  it('displays project phase badge when available', () => {
    render(<App />);

    // Check if project phase is displayed
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('displays script editor version info', () => {
    render(<App />);

    // Check if version info is displayed
    expect(screen.getByText('Script Editor v2.1')).toBeInTheDocument();
    expect(screen.getByText('Real-time Collaboration')).toBeInTheDocument();
  });
});