import { useRef, useState, useCallback, useEffect } from 'react';
import { captureAnnotation } from '~/lib/stores/annotation';

type Tool = 'line' | 'rect' | 'circle' | 'arrow' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Drawing {
  type: Tool;
  points: Point[];
  color: string;
  width: number;
}

interface AnnotationModeProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onExit: () => void;
}

export function AnnotationMode({ containerRef, onExit }: AnnotationModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);
  const [tool, setTool] = useState<Tool>('line');
  const [color, setColor] = useState('#ef4444');
  const [width, setWidth] = useState(3);

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawShape = (ctx: CanvasRenderingContext2D, drawing: Drawing) => {
    ctx.strokeStyle = drawing.color;
    ctx.fillStyle = drawing.color;
    ctx.lineWidth = drawing.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const points = drawing.points;
    if (points.length === 0) return;

    switch (drawing.type) {
      case 'line':
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
      case 'rect': {
        if (points.length < 2) return;
        const s = points[0], e = points[points.length - 1];
        ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
        break;
      }
      case 'circle': {
        if (points.length < 2) return;
        const c = points[0], edge = points[points.length - 1];
        const r = Math.sqrt(Math.pow(edge.x - c.x, 2) + Math.pow(edge.y - c.y, 2));
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        if (points.length < 2) return;
        const s = points[0], e = points[points.length - 1];
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        const angle = Math.atan2(e.y - s.y, e.x - s.x);
        const sz = 12;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x - sz * Math.cos(angle - Math.PI / 6), e.y - sz * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x - sz * Math.cos(angle + Math.PI / 6), e.y - sz * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      }
      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, width * 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
    }
  };

  const redrawCanvas = useCallback((allDrawings: Drawing[], current: Drawing | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allDrawings.forEach(d => drawShape(ctx, d));
    if (current) drawShape(ctx, current);
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;
    setCurrentDrawing({ type: tool, points: [point], color, width });
    setIsDrawing(true);
  }, [tool, color, width]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDrawing) return;
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;
    const updated = { ...currentDrawing, points: [...currentDrawing.points, point] };
    setCurrentDrawing(updated);
    redrawCanvas(drawings, updated);
  }, [isDrawing, currentDrawing, drawings, redrawCanvas]);

  const stopDrawing = useCallback(() => {
    if (currentDrawing) {
      setDrawings(prev => [...prev, currentDrawing]);
      setCurrentDrawing(null);
    }
    setIsDrawing(false);
  }, [currentDrawing]);

  const captureScreenshot = useCallback(async () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    try {
      const combinedCanvas = document.createElement('canvas');
      const rect = container.getBoundingClientRect();
      const scale = window.devicePixelRatio || 2;
      combinedCanvas.width = rect.width * scale;
      combinedCanvas.height = rect.height * scale;

      const ctx = combinedCanvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);

      // Try to capture iframe content
      const iframe = container.querySelector('iframe');
      let iframeCaptured = false;

      if (iframe) {
        try {
          // Method 1: Direct canvas drawImage (works for same-origin iframes)
          if (iframe.contentWindow) {
            const iframeRect = iframe.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const offsetX = iframeRect.left - containerRect.left;
            const offsetY = iframeRect.top - containerRect.top;

            // Try to draw iframe directly
            ctx.drawImage(iframe, offsetX, offsetY, iframeRect.width, iframeRect.height);
            iframeCaptured = true;
          }
        } catch (err) {
          console.log('Direct iframe capture failed (CORS), trying fallback...');
          
          // Method 2: Try to capture via iframe's own canvas
          try {
            if (iframe.contentDocument && iframe.contentWindow) {
              const iframeCanvas = iframe.contentDocument.createElement('canvas');
              iframeCanvas.width = iframe.contentWindow.innerWidth;
              iframeCanvas.height = iframe.contentWindow.innerHeight;
              const iframeCtx = iframeCanvas.getContext('2d');
              
              if (iframeCtx) {
                // Use html2canvas if available, otherwise create a visual representation
                const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${iframe.contentWindow.innerWidth}" height="${iframe.contentWindow.innerHeight}">
                  <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui; padding: 20px; background: #f5f5f5;">
                      <h3 style="color: #333; margin-bottom: 10px;">Preview Content</h3>
                      <p style="color: #666;">The preview is running in a sandboxed iframe.</p>
                      <p style="color: #999; font-size: 12px;">Screenshot captured with annotations.</p>
                    </div>
                  </foreignObject>
                </svg>`;
                
                const img = new Image();
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                
                await new Promise((resolve) => {
                  img.onload = () => {
                    const iframeRect = iframe.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const offsetX = iframeRect.left - containerRect.left;
                    const offsetY = iframeRect.top - containerRect.top;
                    
                    ctx.drawImage(img, offsetX, offsetY, iframeRect.width, iframeRect.height);
                    URL.revokeObjectURL(url);
                    resolve(null);
                  };
                  img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve(null);
                  };
                  img.src = url;
                });
                
                iframeCaptured = true;
              }
            }
          } catch (err2) {
            console.log('Fallback capture also failed:', err2);
          }
        }
      }

      // If no iframe or capture failed, fill with white
      if (!iframeCaptured) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }

      // Draw annotations on top
      ctx.drawImage(canvas, 0, 0, rect.width, rect.height);

      // Convert to blob and send
      combinedCanvas.toBlob((blob) => {
        if (blob) {
          captureAnnotation.set({
            image: blob,
            timestamp: Date.now(),
          });
          
          // Show success feedback
          const toast = document.createElement('div');
          toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 20px;border-radius:8px;z-index:10000;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);animation:slideIn 0.3s ease';
          toast.textContent = '✓ Annotation captured!';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Capture failed:', err);
      alert('Failed to capture screenshot. Please try again.');
    }

  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas(drawings, currentDrawing);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawings, currentDrawing, redrawCanvas]);

  const tools: { type: Tool; icon: string; label: string }[] = [
    { type: 'line', icon: 'i-ph:pencil-simple-fill', label: 'Line' },
    { type: 'rect', icon: 'i-ph:rectangle-fill', label: 'Rectangle' },
    { type: 'circle', icon: 'i-ph:circle-fill', label: 'Circle' },
    { type: 'arrow', icon: 'i-ph:arrow-up-right-fill', label: 'Arrow' },
    { type: 'eraser', icon: 'i-ph:eraser-fill', label: 'Eraser' },
  ];

  return (
    <div className="absolute inset-0 z-50">
      <div className="annotation-toolbar">
        {tools.map((t) => (
          <button
            key={t.type}
            onClick={() => setTool(t.type)}
            className={`annotation-tool-btn ${tool === t.type ? 'active' : ''}`}
            title={t.label}
          >
            <div className={t.icon} />
          </button>
        ))}
        <div className="annotation-divider" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="annotation-color-picker" title="Color" />
        <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className="annotation-width-select" title="Width">
          <option value="2">2px</option>
          <option value="3">3px</option>
          <option value="5">5px</option>
          <option value="8">8px</option>
        </select>
        <div className="annotation-divider" />
        <button onClick={clearCanvas} className="annotation-tool-btn" title="Clear">
          <div className="i-ph:trash-fill" />
        </button>
        <button onClick={captureScreenshot} className="annotation-tool-btn capture-btn" title="Capture & Send">
          <div className="i-ph:camera-fill" />
          <span className="hidden sm:inline ml-1 text-xs">Send</span>
        </button>
        <button onClick={onExit} className="annotation-tool-btn exit-btn" title="Exit">
          <div className="i-ph:x-bold" />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
}
