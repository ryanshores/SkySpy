import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LiveRadioPanel } from './LiveRadioPanel';

beforeEach(() => {
  const storage = new Map();
  localStorage.getItem.mockImplementation((key) => storage.get(key) ?? null);
  localStorage.setItem.mockImplementation((key, value) => storage.set(key, value));
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    fireEvent.playing(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function addRadio(key, label) {
  fireEvent.change(screen.getByLabelText('Feed key'), { target: { value: key } });
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: label } });
  fireEvent.click(screen.getByText('Add radio'));
}

describe('live radios', () => {
  it('plays simultaneous feeds with independent volume and disconnects on stop/removal', () => {
    const { container } = render(<LiveRadioPanel />);
    addRadio('kaus_ground', 'Ground');
    fireEvent.click(screen.getByRole('button', { name: 'Play KAUS Tower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play Ground' }));
    const [tower, ground] = container.querySelectorAll('audio');
    expect(tower.src).toBe('https://d.liveatc.net/kaus3_twr');
    expect(ground.src).toBe('https://d.liveatc.net/kaus_ground');
    fireEvent.change(screen.getByLabelText('Ground volume'), { target: { value: '20' } });
    expect(ground.volume).toBe(0.2);
    expect(tower.volume).toBe(0.7);
    fireEvent.click(screen.getByRole('button', { name: 'Stop KAUS Tower' }));
    expect(tower.hasAttribute('src')).toBe(false);
    expect(ground.hasAttribute('src')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ground' }));
    expect(ground.hasAttribute('src')).toBe(false);
  });

  it('persists selection and volume without restoring playback', () => {
    const first = render(<LiveRadioPanel />);
    addRadio('kaus_ground', 'Ground');
    fireEvent.change(screen.getByLabelText('Ground volume'), { target: { value: '0' } });
    first.unmount();
    const second = render(<LiveRadioPanel />);
    expect(screen.getByLabelText('Ground volume').value).toBe('0');
    expect(
      [...second.container.querySelectorAll('audio')].every((audio) => !audio.hasAttribute('src'))
    ).toBe(true);
  });

  it('rejects URLs and duplicate keys, and allows retry after playback fails', async () => {
    render(<LiveRadioPanel />);
    addRadio('https://example.com', 'Invalid');
    expect(screen.getByRole('alert').textContent).toContain('feed key');
    addRadio('kaus3_twr', 'Duplicate');
    expect(screen.getByRole('alert').textContent).toContain('already');
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Play KAUS Tower' }));
    await waitFor(() => expect(screen.getByText(/Unable to play/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Play KAUS Tower' }));
    expect(screen.getByRole('button', { name: 'Stop KAUS Tower' })).toBeTruthy();
  });
});
