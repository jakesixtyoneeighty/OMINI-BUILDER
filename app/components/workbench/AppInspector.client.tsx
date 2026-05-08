import { useState, useCallback, useEffect } from 'react';
import { classNames } from '~/utils/classNames';

interface InspectorAnnotation {
  id: string;
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  comment: string;
  timestamp: number;
}

interface AppInspectorProps {
  isActive: boolean;
  onToggle: () => void;
  onAddAnnotation: (annotation: InspectorAnnotation) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

// Script to inject into the iframe for element inspection
const INSPECTOR_SCRIPT = `
(function() {
  if (window.__inspectorActive) return;
  window.__inspectorActive = true;

  let overlay = null;
  let label = null;
  let tooltip = null;

  function createUI() {
    overlay = document.createElement('div');
    overlay.id = '__inspector-overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px solid #3b82f6;background:rgba(59,130,246,0.12);transition:all 0.08s ease;border-radius:3px;box-shadow:0 0 0 1px rgba(59,130,246,0.3);';
    document.body.appendChild(overlay);

    label = document.createElement('div');
    label.id = '__inspector-label';
    label.style.cssText = 'position:fixed;z-index:1000000;pointer-events:none;font-family:monospace;font-size:11px;padding:3px 8px;background:#1e293b;color:#60a5fa;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid rgba(96,165,250,0.3);';
    document.body.appendChild(label);

    tooltip = document.createElement('div');
    tooltip.id = '__inspector-tooltip';
    tooltip.style.cssText = 'position:fixed;z-index:1000001;pointer-events:none;font-family:system-ui;font-size:12px;padding:8px 12px;background:#0f172a;color:#e2e8f0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.5);border:1px solid rgba(59,130,246,0.4);max-width:250px;display:none;';
    document.body.appendChild(tooltip);
  }

  function updateOverlay(el) {
    if (!overlay || !el) return;
    const rect = el.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';

    if (label) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(c => c && !c.startsWith('__')).slice(0, 2).join('.') : '';
      label.textContent = tag + id + (cls ? cls.substring(0, 30) : '');
      label.style.display = 'block';

      // Position label above or below element
      const labelH = 22;
      if (rect.top > labelH + 4) {
        label.style.top = (rect.top - labelH - 4) + 'px';
      } else {
        label.style.top = (rect.bottom + 4) + 'px';
      }
      label.style.left = rect.left + 'px';
    }
  }

  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return '';
    let parts = [];
    while (el && el !== document.body && el !== document.documentElement) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        parts.unshift(selector);
        break;
      }
      if (el.className && typeof el.className === 'string') {
        const mainClass = el.className.split(' ').filter(c => c && !c.startsWith('__')).slice(0, 2).join('.');
        if (mainClass) selector += '.' + mainClass;
      }
      parts.unshift(selector);
      el = el.parentElement;
    }
    return parts.slice(-3).join(' > ');
  }

  function getElementInfo(el) {
    const selector = getSelector(el);
    return {
      selector: selector,
      tagName: el.tagName.toLowerCase(),
      className: el.className && typeof el.className === 'string' ? el.className : '',
      textContent: (el.textContent || '').substring(0, 100).trim(),
      dimensions: {
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }
    };
  }

  document.addEventListener('mouseover', function(e) {
    if (!window.__inspectorActive) return;
    if (e.target?.id?.startsWith('__inspector')) return;
    if (!overlay) createUI();
    updateOverlay(e.target);
  }, true);

  document.addEventListener('click', function(e) {
    if (!window.__inspectorActive) return;
    if (e.target?.id?.startsWith('__inspector')) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const info = getElementInfo(e.target);
    window.parent.postMessage({ type: '__inspector-click', data: info }, '*');

    // Flash effect on click
    if (overlay) {
      overlay.style.borderColor = '#f97316';
      overlay.style.background = 'rgba(249,115,22,0.15)';
      setTimeout(() => {
        overlay.style.borderColor = '#3b82f6';
        overlay.style.background = 'rgba(59,130,246,0.12)';
      }, 300);
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (!window.__inspectorActive) return;
    if (overlay) overlay.style.display = 'none';
    if (label) label.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
  }, true);

  // Listen for activate/deactivate messages from parent
  window.addEventListener('message', function(e) {
    if (e.data?.type === '__inspector-activate') {
      window.__inspectorActive = true;
      if (!overlay) createUI();
    }
    if (e.data?.type === '__inspector-deactivate') {
      window.__inspectorActive = false;
      if (overlay) { overlay.remove(); overlay = null; }
      if (label) { label.remove(); label = null; }
      if (tooltip) { tooltip.remove(); tooltip = null; }
    }
  });

  // Signal to parent that inspector script is loaded
  window.parent.postMessage({ type: '__inspector-ready' }, '*');
})();
`;

export type { InspectorAnnotation };
export { AppInspector };

function AppInspector({ isActive, onToggle, onAddAnnotation }: AppInspectorProps) {
  const [annotations, setAnnotations] = useState<InspectorAnnotation[]>([]);
  const [commentInput, setCommentInput] = useState<string>('');
  const [selectedElement, setSelectedElement] = useState<{
    selector: string;
    tagName: string;
    className: string;
    textContent: string;
    dimensions?: { width: number; height: number };
  } | null>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [inspectorReady, setInspectorReady] = useState(false);

  // Find the preview iframe (works for any preview mode)
  const findIframe = useCallback(() => {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (
        iframe.src?.includes('localhost') ||
        iframe.srcdoc ||
        iframe.id?.includes('preview') ||
        iframe.className?.includes('preview') ||
        iframe.closest('[data-preview-content]')
      ) {
        return iframe;
      }
    }
    return null;
  }, []);

  // Inject inspector script into preview iframe and manage activation
  useEffect(() => {
    if (!isActive) {
      // Deactivate in iframe
      const iframe = findIframe();
      if (iframe) {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: '__inspector-deactivate' }, '*');
          }
        } catch {}
      }
      setInspectorReady(false);
      return;
    }

    const injectAndActivate = () => {
      const iframe = findIframe();
      if (!iframe) return;

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.readyState === 'complete') {
          // Check if inspector is already loaded
          const existingScript = doc.getElementById('__inspector-script');
          if (!existingScript) {
            const script = doc.createElement('script');
            script.id = '__inspector-script';
            script.textContent = INSPECTOR_SCRIPT;
            doc.head.appendChild(script);
          } else {
            // Re-activate existing inspector
            iframe.contentWindow?.postMessage({ type: '__inspector-activate' }, '*');
          }
        }
      } catch (err) {
        // Cross-origin iframe — try postMessage activation
        try {
          iframe.contentWindow?.postMessage({ type: '__inspector-activate' }, '*');
        } catch {}
      }
    };

    injectAndActivate();
    const interval = setInterval(injectAndActivate, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [isActive, findIframe]);

  // Listen for inspector events from iframe
  useEffect(() => {
    if (!isActive) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === '__inspector-click') {
        const { selector, tagName, className, textContent, dimensions } = event.data.data;
        setSelectedElement({ selector, tagName, className, textContent, dimensions });
        setShowCommentForm(true);
        setCommentInput('');
      }
      if (event.data?.type === '__inspector-ready') {
        setInspectorReady(true);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isActive]);

  const handleAddComment = useCallback(() => {
    if (!selectedElement || !commentInput.trim()) return;

    const annotation: InspectorAnnotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      selector: selectedElement.selector,
      tagName: selectedElement.tagName,
      className: selectedElement.className,
      textContent: selectedElement.textContent,
      comment: commentInput.trim(),
      timestamp: Date.now(),
    };

    setAnnotations(prev => [...prev, annotation]);
    onAddAnnotation(annotation);
    setShowCommentForm(false);
    setCommentInput('');
    setSelectedElement(null);
  }, [selectedElement, commentInput, onAddAnnotation]);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <>
      {/* Inspector toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className={classNames(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all',
          isActive
            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25 shadow-sm shadow-orange-500/10'
            : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive',
        )}
        title={isActive ? 'Desativar Inspetor' : 'Ativar Inspetor'}
      >
        <div className={classNames('text-sm', isActive ? 'i-ph:magnifying-glass-plus' : 'i-ph:magnifying-glass')} />
        {isActive && <span>Inspetor</span>}
      </button>

      {/* Inspector panel (when active and has annotations) */}
      {isActive && annotations.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl overflow-hidden z-[100]">
          <div className="px-3 py-2 border-b border-bolt-elements-borderColor bg-orange-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="i-ph:magnifying-glass-plus text-orange-400 text-sm" />
                <span className="text-xs font-semibold text-bolt-elements-textPrimary">
                  Anotacoes ({annotations.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAnnotations([])}
                className="text-[10px] text-bolt-elements-textTertiary hover:text-red-400 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto p-1.5 space-y-1">
            {annotations.map(ann => (
              <div
                key={ann.id}
                className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-bolt-elements-background-depth-1 text-left group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <code className="text-[10px] text-orange-400 font-mono truncate">
                      {ann.tagName}{ann.className ? '.' + ann.className.split(' ')[0] : ''}
                    </code>
                    <span className="text-[9px] text-bolt-elements-textTertiary truncate">
                      {ann.selector.substring(0, 40)}
                    </span>
                  </div>
                  <p className="text-[11px] text-bolt-elements-textPrimary mt-0.5">
                    {ann.comment}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAnnotation(ann.id)}
                  className="opacity-0 group-hover:opacity-100 text-bolt-elements-textTertiary hover:text-red-400 transition-all shrink-0"
                >
                  <div className="i-ph:x text-xs" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment form modal (when an element is clicked) */}
      {showCommentForm && selectedElement && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setShowCommentForm(false); setSelectedElement(null); }}>
          <div className="w-96 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-orange-500/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <div className="i-ph:cursor-click text-orange-400 text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bolt-elements-textPrimary">Elemento Selecionado</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary">
                    <code className="text-orange-400">{selectedElement.tagName}</code>
                    {selectedElement.className && (
                      <span>.{selectedElement.className.split(' ').slice(0, 2).join('.')}</span>
                    )}
                    {selectedElement.dimensions && (
                      <span className="text-bolt-elements-textTertiary"> ({selectedElement.dimensions.width}x{selectedElement.dimensions.height})</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3">
              {/* Element info */}
              <div className="px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                <p className="text-[10px] text-bolt-elements-textTertiary mb-1">Seletor CSS</p>
                <code className="text-xs text-orange-400 font-mono break-all">{selectedElement.selector}</code>
                {selectedElement.textContent && (
                  <>
                    <p className="text-[10px] text-bolt-elements-textTertiary mt-1.5 mb-1">Texto</p>
                    <p className="text-xs text-bolt-elements-textSecondary truncate">"{selectedElement.textContent}"</p>
                  </>
                )}
              </div>

              {/* Comment input */}
              <div>
                <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-1">
                  O que deseja alterar? *
                </label>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Ex: Mudar cor do botao para azul, aumentar fonte..."
                  className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition-all resize-none"
                  rows={3}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleAddComment();
                    }
                  }}
                />
                <p className="text-[9px] text-bolt-elements-textTertiary mt-1">Ctrl+Enter para adicionar</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!commentInput.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-500 hover:to-amber-500 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="i-ph:plus text-sm" />
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCommentForm(false); setSelectedElement(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
