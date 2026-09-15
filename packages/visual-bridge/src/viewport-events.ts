/** The visible viewport belongs to the host while application listeners belong to its native Realm. */
export function installViewportEvents(frameWindow: Window, hostWindow: Window): () => void {
  const EventConstructor = frameWindow.document.defaultView!.Event;
  const dispatch = frameWindow.dispatchEvent.bind(frameWindow);
  const resized = (): void => { dispatch(new EventConstructor('resize')); };
  hostWindow.addEventListener('resize', resized);
  return () => { hostWindow.removeEventListener('resize', resized); };
}
