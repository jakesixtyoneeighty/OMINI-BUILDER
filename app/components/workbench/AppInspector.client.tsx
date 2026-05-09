import { useState, useCallback, useEffect, useRef } from 'react';
import { classNames } from '~/utils/classNames';

interface InspectorAnnotation {
  id: string;
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  comment: string;
  timestamp: number;
  attributes?: Record<string, string>;
  dimensions?: { width: number; height: number };
  isInShadowDom?: boolean;
}

interface SelectedElement {
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

interface AppInspectorProps {
  isActive: boolean;
  onToggle: () => void;
  onAddAnnotation: (annotation: InspectorAnnotation) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
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

    /* Flash effect */
    if (overlay) {
      overlay.style.borderColor = '#f97316';
      overlay.style.background = 'rgba(249,115,22,0.15)';
      overlay.style.boxShadow = '0 0 0 2px rgba(249,115,22,0.4),0 0 20px rgba(249,115,22,0.12)';
      setTimeout(function() {
        if (overlay) {
          overlay.style.borderColor = '#3b82f6';
          overlay.style.background = 'rgba(59,130,246,0.10)';
          overlay.style.boxShadow = '0 0 0 1px rgba(59,130,246,0.3),0 0 12px rgba(59,130,246,0.08)';
        }
      }, 400);
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

export type { InspectorAnnotation, SelectedElement };
export { AppInspector };

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

/** Tag icon map for element types */
function getElementIcon(tagName: string): string {
  const map: Record<string, string> = {
    button: 'i-ph:cursor-click',
    input: 'i-ph:text-cursor',
    textarea: 'i-ph:text-aa',
    a: 'i-ph:link',
    img: 'i-ph:image',
    video: 'i-ph:video-camera',
    h1: 'i-ph:text-h',
    h2: 'i-ph:text-h',
    h3: 'i-ph:text-h',
    h4: 'i-ph:text-h',
    h5: 'i-ph:text-h',
    h6: 'i-ph:text-h',
    p: 'i-ph:text-paragraph',
    span: 'i-ph:text-aa',
    div: 'i-ph:square-dashed',
    section: 'i-ph:squares-four',
    nav: 'i-ph:navigation-arrow',
    header: 'i-ph:caret-line-up',
    footer: 'i-ph:caret-line-down',
    form: 'i-ph:note-pencil',
    select: 'i-ph:list',
    table: 'i-ph:table',
    ul: 'i-ph:list-bullets',
    ol: 'i-ph:list-numbers',
    li: 'i-ph:minus',
    svg: 'i-ph:path',
    iframe: 'i-ph:browser',
    label: 'i-ph:tag',
  };
  return map[tagName] || 'i-ph:code';
}

function AppInspector({ isActive, onToggle, onAddAnnotation }: AppInspectorProps) {
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [inspectorReady, setInspectorReady] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

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
      setInspectorReady(false);
      setSelectedElements([]);
      setCommentInput('');
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

  // Listen for inspector click events — add element as chip (no modal!)
  useEffect(() => {
    if (!isActive) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === '__inspector-click') {
        const data = event.data.data;
        const el: SelectedElement = {
          id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          selector: data.selector || '',
          tagName: data.tagName || '',
          className: data.className || '',
          textContent: data.textContent || '',
          dimensions: data.dimensions,
          attributes: data.attributes,
          isInShadowDom: data.isInShadowDom,
        };
        // Add as a chip (like a file attachment)
        setSelectedElements(prev => [...prev, el]);
      }
      if (event.data?.type === '__inspector-ready') {
        setInspectorReady(true);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isActive]);

  const removeElement = useCallback((id: string) => {
    setSelectedElements(prev => prev.filter(el => el.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedElements([]);
    setCommentInput('');
  }, []);

  // Send all selected elements + comment as annotations to the chat
  const handleSend = useCallback(() => {
    if (selectedElements.length === 0) return;

    // Create one annotation per element, all sharing the same comment
    for (const el of selectedElements) {
      const annotation: InspectorAnnotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        selector: el.selector,
        tagName: el.tagName,
        className: el.className,
        textContent: el.textContent,
        comment: commentInput.trim() || '(sem comentario)',
        timestamp: Date.now(),
        attributes: el.attributes,
        dimensions: el.dimensions,
        isInShadowDom: el.isInShadowDom,
      };
      onAddAnnotation(annotation);
    }

    // Clear after sending
    setSelectedElements([]);
    setCommentInput('');
  }, [selectedElements, commentInput, onAddAnnotation]);

  // Format element chip label
  const formatChipLabel = (el: SelectedElement) => {
    const tag = el.tagName;
    const mainClass = el.className ? el.className.split(' ').filter(c => c && !c.startsWith('__') && !c.startsWith('css-')).slice(0, 1)[0] : '';
    const id = el.attributes?.id ? '#' + el.attributes.id : '';
    if (mainClass) return `${tag}.${mainClass}`;
    if (id) return `${tag}${id}`;
    return tag;
  };

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
        <div className={classNames('text-sm', isActive ? (injecting ? 'i-ph:spinner animate-spin' : 'i-ph:magnifying-glass-plus') : 'i-ph:magnifying-glass')} />
        {isActive && <span>{injecting ? 'Injetando...' : 'Inspetor'}</span>}
        {isActive && selectedElements.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-orange-500 text-white">
            {selectedElements.length}
          </span>
        )}
      </button>

      {/* Selected elements bar (appears below toolbar when elements are selected) */}
      {isActive && selectedElements.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl overflow-hidden z-[100]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-bolt-elements-borderColor bg-orange-500/5">
            <div className="flex items-center gap-2">
              <div className="i-ph:cursor-click text-orange-400 text-sm" />
              <span className="text-[11px] font-semibold text-bolt-elements-textPrimary">
                {selectedElements.length} elemento{selectedElements.length > 1 ? 's' : ''} selecionado{selectedElements.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-bolt-elements-textTertiary hover:text-red-400 transition-colors"
            >
              Limpar tudo
            </button>
          </div>

          {/* Element chips (like attached files) */}
          <div className="px-2.5 py-2 flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto">
            {selectedElements.map((el) => (
              <div
                key={el.id}
                className="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-bolt-elements-background-depth-1 border border-orange-500/20 hover:border-orange-500/40 transition-all"
              >
                {/* Element icon */}
                <div className={classNames(getElementIcon(el.tagName), 'text-xs text-orange-400 shrink-0')} />
                {/* Element label */}
                <code className="text-[11px] text-orange-400 font-mono truncate max-w-[120px]">
                  {formatChipLabel(el)}
                </code>
                {/* Preview text (if any) */}
                {el.textContent && (
                  <span className="text-[9px] text-bolt-elements-textTertiary truncate max-w-[60px]">
                    {el.textContent.substring(0, 20)}
                  </span>
                )}
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeElement(el.id)}
                  className="flex items-center justify-center w-4 h-4 rounded text-bolt-elements-textTertiary hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 opacity-60 group-hover:opacity-100"
                >
                  <div className="i-ph:x text-[10px]" />
                </button>
              </div>
            ))}
          </div>

          {/* Comment + Send */}
          <div className="flex items-center gap-1.5 px-2.5 py-2 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Comentario (opcional)..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500/40 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-500 hover:to-amber-500 shadow-sm transition-all shrink-0"
              title="Enviar para o chat (Enter)"
            >
              <div className="i-ph:paper-plane-tilt text-xs" />
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* Hint when inspector is active but no elements selected yet */}
      {isActive && selectedElements.length === 0 && (
        <div className="absolute top-full left-0 mt-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg overflow-hidden z-[100] px-3 py-1.5">
          <p className="text-[11px] text-bolt-elements-textTertiary flex items-center gap-1.5">
            <div className="i-ph:hand-pointing text-orange-400 text-sm" />
            Clique nos elementos do preview para selecionar
          </p>
        </div>
      )}
    </>
  );
}
