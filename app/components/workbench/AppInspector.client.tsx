import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import {
  inspectorStore,
  addInspectorElement,
  setInspectorActive,
  type InspectorElement,
} from '~/lib/stores/inspector';
import { useT } from '~/lib/i18n/useT';

interface AppInspectorProps {
  isActive: boolean;
  onToggle: () => void;
}

/**
 * Inspector script — runs INSIDE the preview iframe.
 * Handles Shadow DOM, SVG, rich element info, sub-iframes.
 */
const INSPECTOR_SCRIPT = `
(function() {
  if (window.__omniInspectorLoaded) return;
  window.__omniInspectorLoaded = true;
  window.__omniInspectorActive = true;

  let overlay = null;
  let label = null;
  let infoPanel = null;
  let lastTarget = null;
  let rafId = null;

  function createUI() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = '__inspector-overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.10);transition:all 0.06s ease;border-radius:3px;box-shadow:0 0 0 1px rgba(59,130,246,0.3),0 0 12px rgba(59,130,246,0.08);display:none;';
    document.documentElement.appendChild(overlay);

    label = document.createElement('div');
    label.id = '__inspector-label';
    label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;line-height:1.4;padding:3px 8px;background:#0f172a;color:#60a5fa;border-radius:4px 4px 4px 0;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.3);display:none;';
    document.documentElement.appendChild(label);

    infoPanel = document.createElement('div');
    infoPanel.id = '__inspector-info';
    infoPanel.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10px;line-height:1.5;padding:4px 8px;background:rgba(15,23,42,0.95);color:#94a3b8;border-radius:0 4px 4px 4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:1px solid rgba(96,165,250,0.2);display:none;max-width:300px;overflow:hidden;text-overflow:ellipsis;';
    document.documentElement.appendChild(infoPanel);
  }

  function removeUI() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (label) { label.remove(); label = null; }
    if (infoPanel) { infoPanel.remove(); infoPanel = null; }
    lastTarget = null;
  }

  function isInspectorElement(el) {
    if (!el) return false;
    if (el.id && el.id.startsWith('__inspector')) return true;
    if (el.tagName === 'SCRIPT' && el.id === '__inspector-script') return true;
    if (el.tagName === 'LINK' && el.id === '__inspector-style') return true;
    return false;
  }

  function resolveTarget(e) {
    var path = e.composedPath();
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (el === document || el === document.documentElement || el === document.body) continue;
      if (el.nodeType !== Node.ELEMENT_NODE) continue;
      if (isInspectorElement(el)) continue;
      return el;
    }
    return e.target;
  }

  function getClassName(el) {
    if (!el) return '';
    if (typeof el.className === 'string') return el.className;
    if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
    if (el.getAttribute) {
      var cls = el.getAttribute('class');
      return cls || '';
    }
    return '';
  }

  function formatLabel(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    var id = el.id ? '#' + el.id : '';
    var cls = getClassName(el);
    var mainClasses = cls.split(/\\s+/).filter(function(c) { return c && !c.startsWith('__') && !c.startsWith('css-') && !c.startsWith('sc-'); }).slice(0, 2);
    var clsStr = mainClasses.length > 0 ? '.' + mainClasses.join('.') : '';
    var dim = Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height);
    return tag + id + (clsStr ? clsStr.substring(0, 35) : '') + ' (' + dim + ')';
  }

  function formatInfo(el) {
    var parts = [];
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (el.id) parts.push('#' + el.id);
    var href = el.getAttribute('href');
    if (href && tag === 'a') parts.push('href="' + href.substring(0, 40) + '"');
    var src = el.getAttribute('src');
    if (src && (tag === 'img' || tag === 'iframe' || tag === 'video' || tag === 'script')) parts.push('src="' + src.substring(0, 40) + '"');
    var alt = el.getAttribute('alt');
    if (alt) parts.push('alt="' + alt.substring(0, 30) + '"');
    var placeholder = el.getAttribute('placeholder');
    if (placeholder) parts.push('placeholder="' + placeholder.substring(0, 30) + '"');
    var role = el.getAttribute('role');
    if (role) parts.push('role="' + role + '"');
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) parts.push('aria-label="' + ariaLabel.substring(0, 30) + '"');
    var type = el.getAttribute('type');
    if (type && (tag === 'input' || tag === 'button')) parts.push('type="' + type + '"');
    var text = getDirectText(el);
    if (text) parts.push('"' + text.substring(0, 40) + '"');
    if (el.getRootNode() !== document) parts.push('[shadow-dom]');
    return parts.join(' | ');
  }

  function getDirectText(el) {
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    text = text.trim();
    if (!text) {
      text = (el.textContent || '').trim().substring(0, 80);
    }
    return text;
  }

  function updateOverlay(el) {
    if (!overlay || !el) return;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      overlay.style.display = 'none';
      if (label) label.style.display = 'none';
      if (infoPanel) infoPanel.style.display = 'none';
      return;
    }
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';

    if (label) {
      label.textContent = formatLabel(el);
      label.style.display = 'block';
      var labelH = 24;
      if (rect.top > labelH + 6) {
        label.style.top = (rect.top - labelH - 2) + 'px';
      } else {
        label.style.top = (rect.bottom + 2) + 'px';
      }
      label.style.left = Math.max(2, rect.left) + 'px';
    }

    if (infoPanel) {
      var infoText = formatInfo(el);
      if (infoText) {
        infoPanel.textContent = infoText;
        infoPanel.style.display = 'block';
        var infoTop = rect.bottom + 2;
        if (label && rect.top <= 24 + 6) {
          infoTop = rect.bottom + 2 + 20;
        }
        infoPanel.style.top = infoTop + 'px';
        infoPanel.style.left = Math.max(2, rect.left) + 'px';
      } else {
        infoPanel.style.display = 'none';
      }
    }
  }

  function scheduleUpdate(el) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function() {
      updateOverlay(el);
      rafId = null;
    });
  }

  function getSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return '';
    var parts = [];
    var current = el;
    var maxDepth = 6;
    while (current && current !== document.body && current !== document.documentElement && maxDepth > 0) {
      var selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
        parts.unshift(selector);
        break;
      }
      var cls = getClassName(current);
      var mainClasses = cls.split(/\\s+/).filter(function(c) {
        return c && !c.startsWith('__') && !c.startsWith('css-') && !c.startsWith('sc-') && !c.startsWith('emotion-');
      }).slice(0, 2);
      if (mainClasses.length > 0) {
        selector += '.' + mainClasses.join('.');
      }
      if (!current.id && mainClasses.length === 0) {
        var parent = current.parentElement;
        if (parent) {
          var siblings = Array.from(parent.children).filter(function(s) { return s.tagName === current.tagName; });
          if (siblings.length > 1) {
            var idx = siblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + idx + ')';
          }
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
      maxDepth--;
    }
    return parts.slice(-4).join(' > ');
  }

  function getElementInfo(el) {
    var selector = getSelector(el);
    var className = getClassName(el);
    var directText = getDirectText(el);

    var attrs = {};
    var importantAttrs = ['id','href','src','alt','title','placeholder','type','name','value','role','aria-label','aria-labelledby','data-testid','for','action','method','target','rel'];
    for (var i = 0; i < importantAttrs.length; i++) {
      var val = el.getAttribute(importantAttrs[i]);
      if (val) attrs[importantAttrs[i]] = val;
    }

    var computed = null;
    try {
      var cs = window.getComputedStyle(el);
      computed = {
        display: cs.display,
        position: cs.position,
        color: cs.color,
        backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '',
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      };
    } catch(e) {}

    var rect = el.getBoundingClientRect();
    return {
      selector: selector,
      tagName: el.tagName.toLowerCase(),
      className: className,
      textContent: directText.substring(0, 120),
      attributes: attrs,
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      styles: computed,
      isInShadowDom: el.getRootNode() !== document,
    };
  }

  /* ---- Event Listeners ---- */

  document.addEventListener('mouseover', function(e) {
    if (!window.__omniInspectorActive) return;
    var target = resolveTarget(e);
    if (!target || isInspectorElement(target)) return;
    if (!overlay) createUI();
    scheduleUpdate(target);
    lastTarget = target;
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (!window.__omniInspectorActive) return;
    var related = e.relatedTarget;
    if (related && isInspectorElement(related)) return;
    setTimeout(function() {
      if (lastTarget && !lastTarget.matches(':hover') && !lastTarget.contains(document.elementFromPoint && document.elementFromPoint(-1,-1))) {
        if (overlay) overlay.style.display = 'none';
        if (label) label.style.display = 'none';
        if (infoPanel) infoPanel.style.display = 'none';
        lastTarget = null;
      }
    }, 80);
  }, true);

  document.addEventListener('click', function(e) {
    if (!window.__omniInspectorActive) return;
    var target = resolveTarget(e);
    if (!target || isInspectorElement(target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var info = getElementInfo(target);
    try { window.parent.postMessage({ type: '__inspector-click', data: info }, '*'); } catch(ex) {}
    try { if (window.opener) window.opener.postMessage({ type: '__inspector-click', data: info }, '*'); } catch(ex) {}

    /* Flash effect — green to indicate "added" */
    if (overlay) {
      overlay.style.borderColor = '#22c55e';
      overlay.style.background = 'rgba(34,197,94,0.15)';
      overlay.style.boxShadow = '0 0 0 2px rgba(34,197,94,0.4),0 0 20px rgba(34,197,94,0.12)';
      setTimeout(function() {
        if (overlay) {
          overlay.style.borderColor = '#3b82f6';
          overlay.style.background = 'rgba(59,130,246,0.10)';
          overlay.style.boxShadow = '0 0 0 1px rgba(59,130,246,0.3),0 0 12px rgba(59,130,246,0.08)';
        }
      }, 600);
    }
  }, true);

  function onScrollOrResize() {
    if (!window.__omniInspectorActive || !lastTarget) return;
    scheduleUpdate(lastTarget);
  }
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize, true);

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === '__inspector-activate') {
      window.__omniInspectorActive = true;
      if (!overlay) createUI();
    }
    if (e.data && e.data.type === '__inspector-deactivate') {
      window.__omniInspectorActive = false;
      removeUI();
    }
  });

  /* Sub-iframe injection */
  function injectIntoSubIframes() {
    try {
      var iframes = document.querySelectorAll('iframe');
      for (var i = 0; i < iframes.length; i++) {
        try {
          var doc = iframes[i].contentDocument;
          if (doc && !doc.getElementById('__inspector-script') && doc.readyState === 'complete') {
            var script = doc.createElement('script');
            script.id = '__inspector-script';
            script.textContent = '(function(){if(window.__omniInspectorLoaded)return;window.__omniInspectorLoaded=true;window.__omniInspectorActive=true;var o=null,l=null;function cu(){o=doc.createElement("div");o.id="__inspector-overlay";o.style.cssText="position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.10);border-radius:3px;display:none;";doc.body.appendChild(o);l=doc.createElement("div");l.id="__inspector-label";l.style.cssText="position:fixed;z-index:2147483647;pointer-events:none;font-size:11px;padding:3px 8px;background:#0f172a;color:#60a5fa;border-radius:4px;white-space:nowrap;display:none;";doc.body.appendChild(l)}doc.addEventListener("mouseover",function(e){if(!window.__omniInspectorActive||e.target.id&&e.target.id.startsWith("__inspector"))return;if(!o)cu();var r=e.target.getBoundingClientRect();o.style.top=r.top+"px";o.style.left=r.left+"px";o.style.width=r.width+"px";o.style.height=r.height+"px";o.style.display="block";if(l){l.textContent=e.target.tagName.toLowerCase();l.style.display="block";l.style.top=(r.top-20)+"px";l.style.left=r.left+"px"}},true);doc.addEventListener("click",function(e){if(!window.__omniInspectorActive)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.parent.postMessage({type:"__inspector-click",data:{selector:e.target.tagName.toLowerCase(),tagName:e.target.tagName.toLowerCase(),className:typeof e.target.className==="string"?e.target.className:"",textContent:(e.target.textContent||"").substring(0,100)}}, "*")},true)});';
            doc.head.appendChild(script);
          }
        } catch (ex) {}
      }
    } catch(e) {}
  }

  var iframeObserver = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeName === 'IFRAME' || (added[j].querySelector && added[j].querySelector('iframe'))) {
          setTimeout(injectIntoSubIframes, 500);
        }
      }
    }
  });
  try { iframeObserver.observe(document.documentElement, { childList: true, subtree: true }); } catch(e) {}
  setTimeout(injectIntoSubIframes, 1500);

  try { window.parent.postMessage({ type: '__inspector-ready' }, '*'); } catch(e) {}
  try { if (window.opener) window.opener.postMessage({ type: '__inspector-ready' }, '*'); } catch(e) {}
})();
`;

async function getWebContainer() {
  try {
    const { webcontainer } = await import('~/lib/webcontainer');
    const wc = await Promise.race([
      webcontainer,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    return wc;
  } catch {
    return null;
  }
}

async function injectInspectorIntoWebContainer(inspectorScriptContent: string): Promise<() => void> {
  const wc = await getWebContainer();
  if (!wc) return () => {};

  const inspectorFileName = '__omni_inspector__.js';
  const scriptTag = `<script src="/${inspectorFileName}" data-omni-inspector><\/script>`;
  const scriptTagPattern = /<script\s+src="\/__omni_inspector__\.js"\s+data-omni-inspector><\/script>/i;

  let originalHtmlContent: string | null = null;
  let htmlPath: string | null = null;
  let wroteToPublic = false;

  try {
    try {
      await wc.fs.mkdir('public', { recursive: true });
      await wc.fs.writeFile('public/' + inspectorFileName, inspectorScriptContent);
      wroteToPublic = true;
    } catch {
      try { await wc.fs.writeFile(inspectorFileName, inspectorScriptContent); } catch {}
    }

    const htmlPaths = ['index.html', 'public/index.html', 'src/index.html'];
    for (const path of htmlPaths) {
      try {
        const content = await wc.fs.readFile(path, 'utf-8');
        if (content && content.includes('<html')) {
          htmlPath = path;
          originalHtmlContent = content;
          break;
        }
      } catch {}
    }

    if (htmlPath && originalHtmlContent) {
      if (!scriptTagPattern.test(originalHtmlContent)) {
        let modified = originalHtmlContent;
        if (modified.includes('</head>')) {
          modified = modified.replace('</head>', scriptTag + '\n</head>');
        } else if (modified.includes('<head>')) {
          modified = modified.replace('<head>', '<head>\n' + scriptTag);
        } else if (modified.includes('<body>')) {
          modified = modified.replace('<body>', scriptTag + '\n<body>');
        } else if (modified.includes('<html')) {
          modified = modified.replace(/<html[^>]*>/, '$&\n' + scriptTag);
        }
        if (modified !== originalHtmlContent) {
          await wc.fs.writeFile(htmlPath, modified);
        }
      }
    }
  } catch (err) {
    console.warn('[Inspector] Failed to inject into WebContainer:', err);
  }

  return async () => {
    try {
      if (wroteToPublic) {
        try { await wc.fs.rm('public/' + inspectorFileName); } catch {}
      } else {
        try { await wc.fs.rm(inspectorFileName); } catch {}
      }
      if (htmlPath && originalHtmlContent) {
        try { await wc.fs.writeFile(htmlPath, originalHtmlContent); } catch {}
      }
    } catch {}
  };
}

function AppInspector({ isActive, onToggle }: AppInspectorProps) {
  const t = useT();
  const [injecting, setInjecting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Read selected elements from the global store
  const selectedElements = useStore(inspectorStore).selectedElements;

  const findIframe = useCallback(() => {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (
        iframe.src?.includes('localhost') ||
        iframe.src?.includes('webcontainer') ||
        iframe.srcdoc ||
        iframe.id?.includes('preview') ||
        iframe.className?.includes('preview') ||
        iframe.className?.includes('webcontainer') ||
        iframe.closest('[data-preview-content]')
      ) {
        return iframe;
      }
    }
    return iframes.length > 0 ? iframes[0] : null;
  }, []);

  const isCrossOriginIframe = useCallback((iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument;
      return !doc;
    } catch {
      return true;
    }
  }, []);

  const injectDirectly = useCallback((iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.readyState === 'complete') {
        const existingScript = doc.getElementById('__inspector-script');
        if (!existingScript) {
          const script = doc.createElement('script');
          script.id = '__inspector-script';
          script.textContent = INSPECTOR_SCRIPT;
          doc.head?.appendChild(script);
        } else {
          iframe.contentWindow?.postMessage({ type: '__inspector-activate' }, '*');
        }
        return true;
      }
    } catch {}
    return false;
  }, []);

  // Sync isActive to global store
  useEffect(() => {
    setInspectorActive(isActive);
  }, [isActive]);

  // Main injection effect
  useEffect(() => {
    if (!isActive) {
      const iframe = findIframe();
      if (iframe) {
        try { iframe.contentWindow?.postMessage({ type: '__inspector-deactivate' }, '*'); } catch {}
      }
      try { window.postMessage({ type: '__inspector-deactivate' }, '*'); } catch {}
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const activate = async () => {
      setInjecting(true);
      const iframe = findIframe();

      if (iframe) {
        const crossOrigin = isCrossOriginIframe(iframe);
        if (crossOrigin) {
          try {
            const cleanup = await injectInspectorIntoWebContainer(INSPECTOR_SCRIPT);
            if (!cancelled) { cleanupRef.current = cleanup; } else { cleanup(); }
          } catch (err) {
            try { iframe.contentWindow?.postMessage({ type: '__inspector-activate' }, '*'); } catch {}
          }
        } else {
          injectDirectly(iframe);
        }
      } else {
        try {
          const cleanup = await injectInspectorIntoWebContainer(INSPECTOR_SCRIPT);
          if (!cancelled) { cleanupRef.current = cleanup; } else { cleanup(); }
        } catch {}
      }
      setInjecting(false);
    };

    activate();

    const interval = setInterval(() => {
      if (cancelled) return;
      const iframe = findIframe();
      if (iframe && !isCrossOriginIframe(iframe)) {
        injectDirectly(iframe);
      }
    }, 3000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [isActive, findIframe, isCrossOriginIframe, injectDirectly]);

  // Listen for inspector click events — push to global store
  useEffect(() => {
    if (!isActive) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === '__inspector-click') {
        const data = event.data.data;
        const el: InspectorElement = {
          id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          selector: data.selector || '',
          tagName: data.tagName || '',
          className: data.className || '',
          textContent: data.textContent || '',
          dimensions: data.dimensions,
          attributes: data.attributes,
          styles: data.styles,
          isInShadowDom: data.isInShadowDom,
        };
        addInspectorElement(el);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isActive]);

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
        title={isActive ? t('inspector.deactivate') : t('inspector.activate')}
      >
        <div className={classNames('text-sm', isActive ? (injecting ? 'i-ph:spinner animate-spin' : 'i-ph:magnifying-glass-plus') : 'i-ph:magnifying-glass')} />
        {isActive && <span>{injecting ? t('inspector.injecting') : t('inspector.inspector')}</span>}
        {isActive && selectedElements.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-orange-500 text-white">
            {selectedElements.length}
          </span>
        )}
      </button>
    </>
  );
}

export { AppInspector };
