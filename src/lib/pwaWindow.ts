/**
 * Open the installed (standalone) PWA maximized on desktop.
 *
 * Web app manifests have no "maximized" display mode, so the installed window is resized from
 * script: Chromium allows moveTo/resizeTo for installed-app windows (never for normal tabs) and
 * remembers the bounds for the next launch. Mobile is left alone: standalone already fills the
 * screen there and resizeTo is ignored.
 */

export interface WindowState {
  standalone: boolean;
  finePointer: boolean;
  outerWidth: number;
  outerHeight: number;
  availWidth: number;
  availHeight: number;
}

type ScreenLike = Pick<Screen, 'availWidth' | 'availHeight'> & {
  availLeft?: number;
  availTop?: number;
};

export type MaximizableWindow = Pick<
  Window,
  'matchMedia' | 'moveTo' | 'resizeTo' | 'outerWidth' | 'outerHeight'
> & { screen: ScreenLike };

export const STANDALONE_QUERY = '(display-mode: standalone)';
const FINE_POINTER_QUERY = '(pointer: fine)';

/** True only for an installed desktop window that is smaller than the available screen. */
export function shouldMaximize(state: WindowState): boolean {
  return (
    state.standalone &&
    state.finePointer &&
    state.availWidth > 0 &&
    state.availHeight > 0 &&
    (state.outerWidth < state.availWidth || state.outerHeight < state.availHeight)
  );
}

/** Resize the installed app window to fill the available screen. Returns whether it tried. */
export function maximizeInstalledWindow(win: MaximizableWindow): boolean {
  const { screen } = win;
  const state: WindowState = {
    standalone: win.matchMedia(STANDALONE_QUERY).matches,
    finePointer: win.matchMedia(FINE_POINTER_QUERY).matches,
    outerWidth: win.outerWidth,
    outerHeight: win.outerHeight,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
  };
  if (!shouldMaximize(state)) return false;
  try {
    win.moveTo(screen.availLeft ?? 0, screen.availTop ?? 0);
    win.resizeTo(screen.availWidth, screen.availHeight);
  } catch {
    return false;
  }
  return true;
}

/** Maximize now, and again if a browser tab is moved into the app window after install. */
export function maximizeOnLaunch(win: MaximizableWindow): void {
  maximizeInstalledWindow(win);
  win.matchMedia(STANDALONE_QUERY).addEventListener('change', (event) => {
    if (event.matches) maximizeInstalledWindow(win);
  });
}
