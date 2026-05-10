import { atom, map } from 'nanostores';

export interface InspectorElement {
  id: string;
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  dimensions?: { width: number; height: number };
  attributes?: Record<string, string>;
  styles?: Record<string, string>;
  isInShadowDom?: boolean;
}

/**
 * Global store for inspector-selected elements.
 * When the user clicks elements in the preview while the inspector is active,
 * those elements are added here and displayed as "attachments" in the chat input.
 */
export const inspectorStore = map({
  /** Currently selected elements from the inspector */
  selectedElements: [] as InspectorElement[],
  /** Whether the inspector is currently active */
  isActive: false,
});

export function addInspectorElement(el: InspectorElement) {
  const current = inspectorStore.get().selectedElements;
  // Avoid duplicates (same selector)
  if (current.some((e) => e.selector === el.selector && e.tagName === el.tagName)) {
    return;
  }
  inspectorStore.setKey('selectedElements', [...current, el]);
}

export function removeInspectorElement(id: string) {
  const current = inspectorStore.get().selectedElements;
  inspectorStore.setKey('selectedElements', current.filter((e) => e.id !== id));
}

export function clearInspectorElements() {
  inspectorStore.setKey('selectedElements', []);
}

export function setInspectorActive(active: boolean) {
  inspectorStore.setKey('isActive', active);
}
