import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Download, PenTool, Type, MousePointer2, FileText,
  Undo2, Redo2, Image as ImageIcon, Eraser, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Highlighter, Square, Circle, Minus, MoveRight,
  Stamp, PenLine, MessageSquare, Search,
  RotateCw, RotateCcw, Trash2, Copy, Plus, FilePlus,
  Scissors, ChevronDown
} from 'lucide-react';

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const Toolbar = ({
  mode, setMode, onUpload, onDownload, hasDocument,
  selectedTextId, currentFont, onFontChange, currentFontSize, onFontSizeChange,
  currentBold, onBoldChange, currentItalic, onItalicChange,
  currentUnderline, onUnderlineChange, currentAlignment, onAlignmentChange,
  currentColor, onColorChange, onUndo, canUndo, onRedo, canRedo, onAddImage,

  zoomLevel, onZoomChange,
  currentPage, numPages, onPageChange,
  strokeWidth, onStrokeWidthChange,
  shapeType, onShapeTypeChange,
  onToggleSearch,
  onOpenStampPicker,
  onOpenSignaturePad,
  onToggleComments,
  showComments,
  highlightColor, onHighlightColorChange,

  onAddBlankPage, onDeletePage, onRotatePage, onDuplicatePage,
}) => {
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const shapeDropdownRef = useRef(null);
  const pageMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (shapeDropdownRef.current && !shapeDropdownRef.current.contains(e.target)) {
        setShowShapeDropdown(false);
      }
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target)) {
        setShowPageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const shapeIcons = {
    rectangle: <Square size={16} />,
    circle: <Circle size={16} />,
    line: <Minus size={16} />,
    arrow: <MoveRight size={16} />,
  };

  return (
    <div className="toolbar">
      {}
      <div className="toolbar-brand">
        <FileText size={22} color="#10b981" />
        <span>PDF Pro</span>
      </div>

      {hasDocument && (
        <div className="toolbar-center">
          {}
          <div className="toolbar-group">
            <button className={`btn btn-tool ${mode === 'select' ? 'active' : ''}`} onClick={() => setMode('select')} title="Select & Move (V)">
              <MousePointer2 size={16} />
            </button>
            <button className={`btn btn-tool ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')} title="Add Text (T)">
              <Type size={16} />
            </button>
            <button className={`btn btn-tool ${mode === 'draw' ? 'active' : ''}`} onClick={() => setMode('draw')} title="Free Draw (D)">
              <PenTool size={16} />
            </button>
            <button className={`btn btn-tool ${mode === 'highlight' ? 'active' : ''}`} onClick={() => setMode('highlight')} title="Highlighter (H)">
              <Highlighter size={16} />
            </button>
            <button className={`btn btn-tool ${mode === 'erase' ? 'active' : ''}`} onClick={() => setMode('erase')} title="Eraser (E)">
              <Eraser size={16} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {}
          <div className="toolbar-group" ref={shapeDropdownRef} style={{ position: 'relative' }}>
            <button
              className={`btn btn-tool ${mode === 'shape' ? 'active' : ''}`}
              onClick={() => {
                if (mode !== 'shape') setMode('shape');
                setShowShapeDropdown(!showShapeDropdown);
              }}
              title="Shapes (S)"
            >
              {shapeIcons[shapeType] || <Square size={16} />}
              <ChevronDown size={10} style={{ marginLeft: -2 }} />
            </button>

            {showShapeDropdown && (
              <div className="dropdown-menu" style={{ minWidth: '140px' }}>
                {[
                  { type: 'rectangle', label: 'Rectangle', icon: <Square size={15} /> },
                  { type: 'circle', label: 'Circle', icon: <Circle size={15} /> },
                  { type: 'line', label: 'Line', icon: <Minus size={15} /> },
                  { type: 'arrow', label: 'Arrow', icon: <MoveRight size={15} /> },
                ].map(s => (
                  <button
                    key={s.type}
                    className={`dropdown-item ${shapeType === s.type ? 'active' : ''}`}
                    onClick={() => {
                      onShapeTypeChange(s.type);
                      setMode('shape');
                      setShowShapeDropdown(false);
                    }}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {}
          <div className="toolbar-group">
            <button className={`btn btn-tool ${mode === 'stamp' ? 'active' : ''}`} onClick={onOpenStampPicker} title="Stamps">
              <Stamp size={16} />
            </button>
            <button className={`btn btn-tool ${mode === 'signature' ? 'active' : ''}`} onClick={onOpenSignaturePad} title="Signature">
              <PenLine size={16} />
            </button>
            <button className={`btn btn-tool ${mode === 'comment' ? 'active' : ''}`} onClick={() => setMode('comment')} title="Comment / Sticky Note (C)">
              <MessageSquare size={16} />
            </button>
            <label className="btn btn-tool" title="Add Image">
              <ImageIcon size={16} />
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                className="hidden-input"
                onChange={(e) => {
                  onAddImage(e.target.files[0]);
                  e.target.value = null;
                }}
              />
            </label>
          </div>

          <div className="toolbar-divider" />

          {}
          <div className="toolbar-group">
            <button className="btn btn-icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 size={16} />
            </button>
            <button className="btn btn-icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <Redo2 size={16} />
            </button>
          </div>

          <div className="toolbar-divider" />

          {}
          <div className="toolbar-group">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              title="Color"
            />
            {(mode === 'highlight') && (
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => onHighlightColorChange(e.target.value)}
                title="Highlight Color"
                style={{ marginLeft: 4 }}
              />
            )}
            {(mode === 'draw' || mode === 'shape' || mode === 'highlight') && (
              <input
                type="number"
                className="toolbar-input stroke-width-input"
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Math.max(1, Math.min(20, Number(e.target.value))))}
                min="1"
                max="20"
                title="Stroke Width"
              />
            )}
          </div>

          {}
          {(mode === 'text' || (selectedTextId && mode === 'select' && !selectedTextId.startsWith('img-') && !selectedTextId.startsWith('stamp-') && !selectedTextId.startsWith('sig-'))) && (
            <>
              <div className="toolbar-divider" />
              <div className="toolbar-group">
                <select
                  className="toolbar-select font-select"
                  value={currentFont || 'Helvetica'}
                  onChange={(e) => onFontChange(e.target.value)}
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="TimesRoman">Times Roman</option>
                  <option value="Courier">Courier</option>
                </select>
                <input
                  type="number"
                  className="toolbar-input font-size-input"
                  value={currentFontSize || 16}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  min="8"
                  max="144"
                  title="Font Size"
                />
              </div>
              <div className="toolbar-group">
                <button className={`btn btn-tool ${currentBold ? 'active' : ''}`} onClick={() => onBoldChange(!currentBold)} title="Bold (Ctrl+B)" style={{ padding: '5px' }}>
                  <Bold size={14} />
                </button>
                <button className={`btn btn-tool ${currentItalic ? 'active' : ''}`} onClick={() => onItalicChange(!currentItalic)} title="Italic (Ctrl+I)" style={{ padding: '5px' }}>
                  <Italic size={14} />
                </button>
                <button className={`btn btn-tool ${currentUnderline ? 'active' : ''}`} onClick={() => onUnderlineChange(!currentUnderline)} title="Underline (Ctrl+U)" style={{ padding: '5px' }}>
                  <Underline size={14} />
                </button>
              </div>
              <div className="toolbar-group">
                <button className={`btn btn-tool ${currentAlignment === 'left' ? 'active' : ''}`} onClick={() => onAlignmentChange('left')} title="Align Left" style={{ padding: '5px' }}>
                  <AlignLeft size={14} />
                </button>
                <button className={`btn btn-tool ${currentAlignment === 'center' ? 'active' : ''}`} onClick={() => onAlignmentChange('center')} title="Align Center" style={{ padding: '5px' }}>
                  <AlignCenter size={14} />
                </button>
                <button className={`btn btn-tool ${currentAlignment === 'right' ? 'active' : ''}`} onClick={() => onAlignmentChange('right')} title="Align Right" style={{ padding: '5px' }}>
                  <AlignRight size={14} />
                </button>
                <button className={`btn btn-tool ${currentAlignment === 'justify' ? 'active' : ''}`} onClick={() => onAlignmentChange('justify')} title="Justify" style={{ padding: '5px' }}>
                  <AlignJustify size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {}
      <div className="toolbar-actions">
        {hasDocument && (
          <>
            {}
            <button className="btn btn-icon" onClick={onToggleSearch} title="Search (Ctrl+F)">
              <Search size={16} />
            </button>

            {}
            <button className={`btn btn-icon ${showComments ? 'active' : ''}`} onClick={onToggleComments} title="Comments Panel">
              <MessageSquare size={16} />
            </button>

            <div className="toolbar-divider" />

            {}
            <div className="toolbar-group">
              <button className="btn btn-icon" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} title="Previous Page (←)">
                <ChevronLeft size={16} />
              </button>
              <input
                type="number"
                className="toolbar-input page-input"
                value={currentPage}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  if (p >= 1 && p <= numPages) onPageChange(p);
                }}
                min="1"
                max={numPages}
              />
              <span className="toolbar-label">/ {numPages}</span>
              <button className="btn btn-icon" onClick={() => onPageChange(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} title="Next Page (→)">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="toolbar-divider" />

            {}
            <div className="toolbar-group">
              <button className="btn btn-icon" onClick={() => onZoomChange(Math.max(0.25, zoomLevel - 0.25))} title="Zoom Out (-)">
                <ZoomOut size={16} />
              </button>
              <select
                className="toolbar-select zoom-select"
                value={zoomLevel}
                onChange={(e) => onZoomChange(Number(e.target.value))}
              >
                {ZOOM_LEVELS.map(z => (
                  <option key={z} value={z}>{Math.round(z * 100)}%</option>
                ))}
              </select>
              <button className="btn btn-icon" onClick={() => onZoomChange(Math.min(5, zoomLevel + 0.25))} title="Zoom In (+)">
                <ZoomIn size={16} />
              </button>
            </div>

            <div className="toolbar-divider" />

            {}
            <div className="toolbar-group" ref={pageMenuRef} style={{ position: 'relative' }}>
              <button className="btn btn-tool" onClick={() => setShowPageMenu(!showPageMenu)} title="Page Options">
                <FilePlus size={16} />
                <ChevronDown size={10} style={{ marginLeft: -2 }} />
              </button>
              {showPageMenu && (
                <div className="dropdown-menu" style={{ right: 0, left: 'auto' }}>
                  <button className="dropdown-item" onClick={() => { onAddBlankPage(); setShowPageMenu(false); }}>
                    <Plus size={14} /> Add Blank Page
                  </button>
                  <button className="dropdown-item" onClick={() => { onDuplicatePage(currentPage); setShowPageMenu(false); }}>
                    <Copy size={14} /> Duplicate Page
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { onRotatePage(currentPage, 90); setShowPageMenu(false); }}>
                    <RotateCw size={14} /> Rotate CW
                  </button>
                  <button className="dropdown-item" onClick={() => { onRotatePage(currentPage, -90); setShowPageMenu(false); }}>
                    <RotateCcw size={14} /> Rotate CCW
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { onDeletePage(currentPage); setShowPageMenu(false); }} disabled={numPages <= 1} style={{ opacity: numPages <= 1 ? 0.4 : 1 }}>
                    <Trash2 size={14} /> Delete Page
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="toolbar-divider" />

        <label className="btn btn-secondary">
          <Upload size={14} />
          Open
          <input
            type="file"
            accept="application/pdf"
            className="hidden-input"
            onChange={(e) => {
              onUpload(e);
              e.target.value = null;
            }}
          />
        </label>

        {hasDocument && (
          <button className="btn btn-primary" onClick={onDownload}>
            <Download size={14} />
            Export
          </button>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
