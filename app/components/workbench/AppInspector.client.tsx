import { useState, useCallback, useRef, useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
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

  let hoveredElement = null;
  let overlay = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = '__inspector-overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);transition:all 0.1s ease;border-radius:4px;';
    document.body.appendChild(overlay);

    // Label
    const label = document.createElement('div');
    label.id = '__inspector-label';
    label.style.cssText = 'position:fixed;z-index:1000000;pointer-events:none;font-family:monospace;font-size:11px;padding:2px 6px;background:#1e293b;color:#60a5fa;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(label);
  }

  function updateOverlay(el) {
    if (!overlay || !el) return;
    const rect = el.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    const label = document.getElementById('__inspector-label');
    if (label) {
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : '';
      const id = el.id ? '#' + el.id : '';
      label.textContent = tag + id + (cls ? cls.substring(0, 30) : '');
      label.style.top = (rect.top - 22) + 'px';
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

  document.addEventListener('mouseover', function(e) {
    if (!window.__inspectorActive) return;
    if (e.target === overlay || e.target?.id?.startsWith('__inspector')) return;
    hoveredElement = e.target;
    if (!overlay) createOverlay();
    updateOverlay(hoveredElement);
  }, true);

  document.addEventListener('click', function(e) {
    if (!window.__inspectorActive) return;
    if (e.target === overlay || e.target?.id?.startsWith('__inspector')) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    const selector = getSelector(el);
    const info = {
      selector: selector,
      tagName: el.tagName.toLowerCase(),
      className: el.className && typeof el.className === 'string' ? el.className : '',
      textContent: (el.textContent || '').substring(0, 100).trim(),
    };

    window.parent.postMessage({ type: '__inspector-click', data: info }, '*');
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (!window.__inspectorActive) return;
    if (overlay) {
      overlay.style.display = 'none';
      const label = document.getElementById('__inspector-label');
      if (label) label.style.display = 'none';
    }
  }, true);

  window.addEventListener('__inspector-deactivate', function() {
    window.__inspectorActive = false;
    if (overlay) { overlay.remove(); overlay = null; }
    const label = document.getElementById('__inspector-label');
    if (label) label.remove();
  });
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
  } | null>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);

  // Inject inspector script into preview iframe
  useEffect(() => {
    if (!isActive) return;

    const findIframe = () => {
      // Try to find the preview iframe
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (iframe.src?.includes('localhost') || iframe.srcdoc || iframe.id?.includes('preview')) {
          return iframe;
        }
      }
      return null;
    };

    const injectScript = () => {
      const iframe = findIframe();
      if (!iframe) return;

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.readyState === 'complete') {
          const script = doc.createElement('script');
          script.textContent = INSPECTOR_SCRIPT;
          doc.head.appendChild(script);
        }
      } catch (err) {
        // Cross-origin iframe — can't inject directly
        console.warn('[Inspector] Cannot inject into cross-origin iframe. For WebContainer, use srcdoc injection.');
      }
    };

    // Try injecting periodically
    injectScript();
    const interval = setInterval(injectScript, 3000);

    return () => {
      clearInterval(interval);
      // Deactivate inspector in iframe
      try {
        const iframe = findIframe();
        if (iframe?.contentWindow) {
          iframe.contentWindow.dispatchEvent(new Event('__inspector-deactivate'));
        }
      } catch {}
    };
  }, [isActive]);

  // Listen for inspector click events from iframe
  useEffect(() => {
    if (!isActive) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === '__inspector-click') {
        const { selector, tagName, className, textContent } = event.data.data;
        setSelectedElement({ selector, tagName, className, textContent });
        setShowCommentForm(true);
        setCommentInput('');
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
  }, [selectedElement, commentInput, onAddComment]);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const buildAnnotationMessage = useCallback(() => {
    if (annotations.length === 0) return '';
    return annotations.map(a => {
      const elDesc = `<${a.tagName}${a.className ? ' class="' + a.className.split(' ').slice(0, 2).join(' ') + '"' : ''}>`;
      return `[Inspector: ${a.selector} (${elDesc})] — ${a.comment}`;
    }).join('\n');
  }, [annotations]);

  // Expose a method to get annotation text for the chat
  useEffect(() => {
    (window as any).__inspectorAnnotations = buildAnnotationMessage();
  }, [buildAnnotationMessage]);

  return (
    <>
      {/* Inspector toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className={classNames(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all',
          isActive
            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
            : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive',
        )}
        title={isActive ? 'Desativar Inspetor' : 'Ativar Inspetor'}
      >
        <div className="i-ph:magnifying-glass-plus text-sm" />
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
                  Anotacoes do Inspetor ({annotations.length})
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
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-96 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-orange-500/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <div className="i-ph:magnifying-glass-plus text-orange-400 text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bolt-elements-textPrimary">Adicionar Comentario</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary">
                    Elemento: <code className="text-orange-400">{selectedElement.tagName}</code>
                    {selectedElement.className && (
                      <span className="text-bolt-elements-textTertiary">
                        {' '}.{selectedElement.className.split(' ').slice(0, 2).join('.')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3">
              {/* Element info */}
              <div className="px-3 py-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                <p className="text-[10px] text-bolt-elements-textTertiary mb-1">Seletor</p>
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
                  Seu comentario *
                </label>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Ex: Esse botao esta com cor errada, mudar para azul..."
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
