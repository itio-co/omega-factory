import { describe, expect, it, vi } from 'vitest';
import {
  LAUNCH_MARKER,
  STANDALONE_QUERY,
  maximizeIfEnabled,
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

/** sessionStorage stand-in; the same instance across calls models reloads in one window. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}
const desktop = { [STANDALONE_QUERY]: true, '(pointer: fine)': true };

describe('maximizeOnLaunch', () => {
  it('maximizes when a tab is moved into the app window after install, once', () => {
    const media: Record<string, boolean> = { '(pointer: fine)': true };
    const { win, asWindow, listeners } = fakeWindow(media);
    const storage = memoryStorage();
    maximizeOnLaunch(asWindow, storage);
    expect(win.resizeTo).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0); // a browser tab leaves no marker
    media[STANDALONE_QUERY] = true;
    listeners.forEach((fn) => fn({ matches: true }));
    expect(win.resizeTo).toHaveBeenCalledWith(1920, 1040);
    listeners.forEach((fn) => fn({ matches: true }));
    expect(win.resizeTo).toHaveBeenCalledOnce();
  });

  it('a reload in the same window never re-maximizes a restored window (AC2)', () => {
    const storage = memoryStorage();
    const first = fakeWindow(desktop);
    maximizeOnLaunch(first.asWindow, storage);
    expect(first.win.resizeTo).toHaveBeenCalledOnce();
    expect(storage.data.get(LAUNCH_MARKER)).toBe('1');
    // The player restores the window to 1280x800 and reloads: same sessionStorage.
    const reloaded = fakeWindow(desktop);
    maximizeOnLaunch(reloaded.asWindow, storage);
    expect(reloaded.win.resizeTo).not.toHaveBeenCalled();
    expect(reloaded.win.moveTo).not.toHaveBeenCalled();
  });

  it('sets the marker even when the window already fills the screen', () => {
    const storage = memoryStorage();
    const full = fakeWindow(desktop, { w: 1920, h: 1040 });
    maximizeOnLaunch(full.asWindow, storage);
    expect(full.win.resizeTo).not.toHaveBeenCalled();
    const restored = fakeWindow(desktop);
    maximizeOnLaunch(restored.asWindow, storage);
    expect(restored.win.resizeTo).not.toHaveBeenCalled();
  });

  it('does nothing without usable sessionStorage', () => {
    const { win, asWindow } = fakeWindow(desktop);
    maximizeOnLaunch(asWindow, null);
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    maximizeOnLaunch(asWindow, throwing);
    expect(win.resizeTo).not.toHaveBeenCalled();
  });
});

describe('maximizeIfEnabled (features.maximizeOnLaunch)', () => {
  it('flag off: no resize, no marker, no listener', () => {
    const { win, asWindow, listeners } = fakeWindow(desktop);
    const storage = memoryStorage();
    expect(maximizeIfEnabled({ maximizeOnLaunch: false }, asWindow, storage)).toBe(false);
    expect(win.resizeTo).not.toHaveBeenCalled();
    expect(win.moveTo).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
    expect(listeners).toHaveLength(0);
  });

  it('flag on: resizes once per launch', () => {
    const { win, asWindow } = fakeWindow(desktop);
    const storage = memoryStorage();
    expect(maximizeIfEnabled({ maximizeOnLaunch: true }, asWindow, storage)).toBe(true);
    expect(win.resizeTo).toHaveBeenCalledOnce();
    maximizeIfEnabled({ maximizeOnLaunch: true }, asWindow, storage);
    expect(win.resizeTo).toHaveBeenCalledOnce();
  });

  it('flag on, reload with the marker already set: no resize', () => {
    const { win, asWindow } = fakeWindow(desktop);
    const storage = memoryStorage();
    storage.setItem(LAUNCH_MARKER, '1');
    maximizeIfEnabled({ maximizeOnLaunch: true }, asWindow, storage);
    expect(win.resizeTo).not.toHaveBeenCalled();
  });

  it('a new launch (fresh sessionStorage) maximizes again', () => {
    for (let launch = 0; launch < 2; launch++) {
      const { win, asWindow } = fakeWindow(desktop);
      maximizeIfEnabled({ maximizeOnLaunch: true }, asWindow, memoryStorage());
      expect(win.resizeTo).toHaveBeenCalledOnce();
    }
  });
});
