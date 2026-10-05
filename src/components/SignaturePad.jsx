import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';

const SignaturePad = ({ onSave, onClose }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [penColor, setPenColor] = useState('#1a1a2e');
  const [penWidth, setPenWidth] = useState(2.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 560;
    canvas.height = 200;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw signature line
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(40, 160);
    ctx.lineTo(520, 160);
    ctx.stroke();
    ctx.setLineDash([]);
    // "Sign here" text
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Sign here', 40, 180);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(40, 160);
    ctx.lineTo(520, 160);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Sign here', 40, 180);
    setHasContent(false);
  };

  const handleSave = () => {
    if (!hasContent) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container signature-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Draw Your Signature</h3>
          <button className="btn btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="signature-canvas-wrapper">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ cursor: 'crosshair' }}
          />
        </div>

        <div className="signature-options">
          <div className="sig-color-options">
            {['#1a1a2e', '#1e40af', '#991b1b'].map(c => (
              <button
                key={c}
                className={`sig-color-btn ${penColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setPenColor(c)}
              />
            ))}
          </div>
          <div className="sig-width-options">
            <label>Thickness</label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={penWidth}
              onChange={e => setPenWidth(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleClear}>
            <RotateCcw size={16} /> Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!hasContent}
            style={{ opacity: hasContent ? 1 : 0.5 }}
          >
            <Check size={16} /> Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
