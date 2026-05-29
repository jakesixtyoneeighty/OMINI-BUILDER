import { useRef, useState, useCallback, useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { captureAnnotation } from '~/lib/stores/annotation';
import { chatStore } from '~/lib/stores/chat';

type Tool = 'select' | 'line' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Drawing {
  type: Tool;
  points: Point[];
  color: string;
  width: number;
  text?: string;
}

interface AnnotationModeProps {
  previewRef: React.RefObject<HTMLIFrameElement>;
  onCapture: (imageDataUrl: string) => void;
}

export function AnnotationMode({ previewRef, onCapture }: AnnotationModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Drawing | null>(null);
  const [tool, setTool] = useState<Tool>('line');
  const [color, setColor] = useState('#ff0000');
  const [width, setWidth] = useState(3);
  const [isActive, setIsActive] = useState(false);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const newDrawing: Drawing = {
      type: tool,
      points: [point],
      color,
      width,
    };

    setCurrentDrawing(newDrawing);
    setIsDrawing(true);
  }, [isActive, tool, color, width]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setCurrentDrawing({
      ...currentDrawing,
      points: [...currentDrawing.points, point],
    });

    // Redraw canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all previous drawings
    drawings.forEach(d => drawShape(ctx, d));
    
    // Draw current drawing
    drawShape(ctx, currentDrawing);
  }, [isDrawing, currentDrawing, drawings]);

  const stopDrawing = useCallback(() => {
    if (currentDrawing) {
      setDrawings([...drawings, currentDrawing]);
      setCurrentDrawing(null);
    }
    setIsDrawing(false);
  }, [currentDrawing, drawings]);

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

      case 'rect':
        if (points.length < 2) return;
        const start = points[0];
        const end = points[points.length - 1];
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        break;

      case 'circle':
        if (points.length < 2) return;
        const center = points[0];
        const edge = points[points.length - 1];
        const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case 'arrow':
        if (points.length < 2) return;
        const arrowStart = points[0];
        const arrowEnd = points[points.length - 1];
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(arrowStart.x, arrowStart.y);
        ctx.lineTo(arrowEnd.x, arrowEnd.y);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(arrowEnd.y - arrowStart.y, arrowEnd.x - arrowStart.x);
        const arrowSize = 10;
        ctx.beginPath();
        ctx.moveTo(arrowEnd.x, arrowEnd.y);
        ctx.lineTo(
          arrowEnd.x - arrowSize * Math.cos(angle - Math.PI / 6),
          arrowEnd.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(arrowEnd.x, arrowEnd.y);
        ctx.lineTo(
          arrowEnd.x - arrowSize * Math.cos(angle + Math.PI / 6),
          arrowEnd.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;

      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, width * 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
    }
  };

  const captureScreenshot = useCallback(async () => {
    const canvas = canvasRef.current;
    const iframe = previewRef.current;
    
    if (!canvas) return;

    try {
      // Create a canvas to combine iframe + annotations
      const combinedCanvas = document.createElement('canvas');
      const containerRect = canvas.getBoundingClientRect();
      combinedCanvas.width = containerRect.width;
      combinedCanvas.height = containerRect.height;
      
      const ctx = combinedCanvas.getContext('2d');
      if (!ctx) return;

      // Try to capture iframe content
      try {
        if (iframe && iframe.contentDocument) {
          // Try to get iframe content (works for same-origin)
          const iframeBody = iframe.contentDocument.body;
          if (iframeBody) {
            // Use html2canvas in production for better results
            // For now, capture white background + annotations
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
          }
        } else {
          // Fallback: white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        }
      } catch (e) {
        // CORS error - just use white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
      }

      // Draw annotations on top
      ctx.drawImage(canvas, 0, 0);

      // Convert to data URL
      const imageDataUrl = combinedCanvas.toDataURL('image/png');
      
      // Store the capture globally
      captureAnnotation(imageDataUrl);
      
      // Also call the callback if provided
      if (onCapture) {
        onCapture(imageDataUrl);
      }
      
      // Clear canvas
      setDrawings([]);
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }, [previewRef, onCapture]);

  const clearCanvas = useCallback(() => {
    setDrawings([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const toggleActive = useCallback(() => {
    setIsActive(!isActive);
    if (!isActive) {
      // Clear when activating
      clearCanvas();
    }
  }, [isActive, clearCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  if (!isActive) {
    return (
      <IconButton
        icon="i-ph:pencil-simple-line-duotone"
        title="Annotation Mode"
        onClick={toggleActive}
      />
    );
  }

  return (
    <div className="annotation-mode">
      <div className="annotation-toolbar">
        <IconButton
          icon="i-ph:line-duotone"
          title="Line"
          className={tool === 'line' ? 'active' : ''}
          onClick={() => setTool('line')}
        />
        <IconButton
          icon="i-ph:rectangle-duotone"
          title="Rectangle"
          className={tool === 'rect' ? 'active' : ''}
          onClick={() => setTool('rect')}
        />
        <IconButton
          icon="i-ph:circle-duotone"
          title="Circle"
          className={tool === 'circle' ? 'active' : ''}
          onClick={() => setTool('circle')}
        />
        <IconButton
          icon="i-ph:arrow-up-right-duotone"
          title="Arrow"
          className={tool === 'arrow' ? 'active' : ''}
          onClick={() => setTool('arrow')}
        />
        <IconButton
          icon="i-ph:eraser-duotone"
          title="Eraser"
          className={tool === 'eraser' ? 'active' : ''}
          onClick={() => setTool('eraser')}
        />
        
        <div className="annotation-divider" />
        
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="annotation-color-picker"
          title="Color"
        />
        
        <select
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="annotation-width-select"
          title="Line Width"
        >
          <option value="1">1px</option>
          <option value="2">2px</option>
          <option value="3">3px</option>
          <option value="5">5px</option>
          <option value="8">8px</option>
        </select>
        
        <div className="annotation-divider" />
        
        <IconButton
          icon="i-ph:trash-duotone"
          title="Clear All"
          onClick={clearCanvas}
        />
        <IconButton
          icon="i-ph:camera-duotone"
          title="Capture & Send"
          onClick={captureScreenshot}
        />
        <IconButton
          icon="i-ph:x-duotone"
          title="Exit Annotation Mode"
          onClick={toggleActive}
        />
      </div>
      
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
}
