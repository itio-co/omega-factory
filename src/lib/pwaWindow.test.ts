import { describe, expect, it, vi } from 'vitest';
import {
  STANDALONE_QUERY,
  maximizeInstalledWindow,
  maximizeOnLaunch,
  shouldMaximize,
  type MaximizableWindow,
  type WindowState,
} from './pwaWindow';

const installedDesktop: WindowState = {
  standalone: true,
  finePointer: true,
  outerWidth: 1280,
  outerHeight: 800,
  availWidth: 1920,
  availHeight: 1040,
};

describe('shouldMaximize', () => {
  it('maximizes a small installed desktop window', () => {
    expect(shouldMaximize(installedDesktop)).toBe(true);
  });

  it('maximizes when only one dimension is short', () => {
    expect(shouldMaximize({ ...installedDesktop, outerWidth: 1920 })).toBe(true);
  });

  it('leaves a normal browser tab alone', () => {
    expect(shouldMaximize({ ...installedDesktop, standalone: false })).toBe(false);
  });

  it('leaves touch/mobile devices alone', () => {
    expect(shouldMaximize({ ...installedDesktop, finePointer: false })).toBe(false);
  });

  it('does nothing when the window already fills the screen', () => {
    expect(shouldMaximize({ ...installedDesktop, outerWidth: 1920, outerHeight: 1040 })).toBe(
      false,
    );
  });

  it('does nothing when the screen size is unknown', () => {
    expect(shouldMaximize({ ...installedDesktop, availWidth: 0, availHeight: 0 })).toBe(false);
  });
});

function fakeWindow(media: Record<string, boolean>, size = { w: 1280, h: 800 }) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const win = {
    outerWidth: size.w,
    outerHeight: size.h,
    screen: { availWidth: 1920, availHeight: 1040, availLeft: 0, availTop: 0 },
    moveTo: vi.fn(),
    resizeTo: vi.fn(),
    matchMedia: vi.fn((query: string) => ({
      matches: media[query] ?? false,
      addEventListener: (_type: string, fn: (event: { matches: boolean }) => void) =>
        listeners.push(fn),
    })),
  };
  return { win, asWindow: win as unknown as MaximizableWindow, listeners };
}

describe('maximizeInstalledWindow', () => {
  it('moves and resizes an installed desktop window to the available screen', () => {
    const { win, asWindow } = fakeWindow({ [STANDALONE_QUERY]: true, '(pointer: fine)': true });
    expect(maximizeInstalledWindow(asWindow)).toBe(true);
    expect(win.moveTo).toHaveBeenCalledWith(0, 0);
    expect(win.resizeTo).toHaveBeenCalledWith(1920, 1040);
  });

  it('never touches a browser tab', () => {
    const { win, asWindow } = fakeWindow({ '(pointer: fine)': true });
    expect(maximizeInstalledWindow(asWindow)).toBe(false);
    expect(win.resizeTo).not.toHaveBeenCalled();
    expect(win.moveTo).not.toHaveBeenCalled();
  });

  it('swallows a browser that refuses resizeTo', () => {
    const { win, asWindow } = fakeWindow({ [STANDALONE_QUERY]: true, '(pointer: fine)': true });
    win.resizeTo.mockImplementation(() => {
      throw new Error('not allowed');
    });
    expect(maximizeInstalledWindow(asWindow)).toBe(false);
  });
});

describe('maximizeOnLaunch', () => {
  it('maximizes when a tab is moved into the app window after install', () => {
    const media: Record<string, boolean> = { '(pointer: fine)': true };
    const { win, asWindow, listeners } = fakeWindow(media);
    maximizeOnLaunch(asWindow);
    expect(win.resizeTo).not.toHaveBeenCalled();
    media[STANDALONE_QUERY] = true;
    listeners.forEach((fn) => fn({ matches: true }));
    expect(win.resizeTo).toHaveBeenCalledWith(1920, 1040);
  });
});
