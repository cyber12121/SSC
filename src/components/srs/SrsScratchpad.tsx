import React, { useRef, useState, useEffect } from 'react';
import { Eraser, RotateCcw, X, Palette, PenTool, Minimize2, Maximize2 } from 'lucide-react';

interface SrsScratchpadProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SrsScratchpad: React.FC<SrsScratchpadProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState<string>('#f59e0b'); // amber default
  const [penSize, setPenSize] = useState<number>(3);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [isOpen, isMinimized]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current state to history for undo
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory(prev => [...prev.slice(-15), snapshot]);
    } catch {}

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    ctx.putImageData(lastState, 0, 0);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
      isMinimized ? 'w-72 h-14' : 'w-[420px] sm:w-[500px] h-[340px]'
    }`}>
      {/* Scratchpad Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80 text-white select-none">
        <div className="flex items-center space-x-2">
          <PenTool className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold tracking-wider uppercase">Math & Rough Scratchpad</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
            title="Close Scratchpad"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Controls toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-850 border-b border-slate-750 text-xs">
            {/* Color swatches */}
            <div className="flex items-center space-x-2">
              {['#f59e0b', '#38bdf8', '#4ade80', '#ffffff', '#f43f5e'].map(c => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    penColor === c ? 'scale-125 ring-2 ring-white shadow-xs' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="h-4 w-px bg-slate-700 mx-1" />
              {/* Pen sizes */}
              {[2, 4, 7].map(size => (
                <button
                  key={size}
                  onClick={() => setPenSize(size)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    penSize === size ? 'bg-slate-700 text-amber-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {size === 2 ? 'Fine' : size === 4 ? 'Med' : 'Thick'}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                title="Undo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClear}
                className="flex items-center px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-[11px] font-medium transition-colors"
                title="Clear Canvas"
              >
                <Eraser className="w-3 h-3 mr-1" />
                Clear
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div className="relative flex-1 bg-slate-950 cursor-crosshair touch-none">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="absolute inset-0 w-full h-full"
            />
            {history.length === 0 && !isDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 text-xs select-none">
                Write formulas, calculation steps, or puzzle logic here...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
