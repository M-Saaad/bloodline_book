# Add goat unsaved draft guard

When the Add goat form differs from its session baseline, leaving the screen asks:

**“Discard this goat?”** → **Keep editing** / **Discard**

## Covered exits

- Bottom tabs (Today, Herd, Breeding, More)
- Header **Back** and stack `GO_BACK` (`usePreventRemove`)
- Android hardware back (`BackHandler`)
- Quick add (**＋**) tiles, including another **Add goat**
- `pushNewAddAnimalSession()` from dashboard / herd entry points (when Add goat is still focused and dirty)

In-form pickers (date, parents, etc.) do not count as leaving the screen.

## Browser / refresh limitations

- **Desktop browsers:** `beforeunload` may show a native “leave site?” prompt when the tab is closed or refreshed; custom copy is not guaranteed.
- **Browser back:** In-app header **Back** confirms before `navigation.goBack()`. The OS/browser back button on web may still bypass the stack; treat as best-effort outside the in-app header.
- **Mobile Safari / installed PWA:** Tab close, swipe-away, and OS gestures may not run JavaScript; treat refresh/close as best-effort only.
- **Native apps:** Use header back or hardware back; do not rely on browser APIs.

No autosave or cross-session draft storage.
