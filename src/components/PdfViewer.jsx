import React, { useEffect, useRef, useState } from 'react';

const getFontFamilyCSS = (fontName) => {
  switch (fontName) {
    case 'TimesRoman': return '"Times New Roman", Times, serif';
    case 'Courier': return '"Courier New", Courier, monospace';
    case 'Helvetica':
    default:
      return 'Helvetica, Arial, sans-serif';
  }
};

/**
 * Detects text formatting properties from a pdf.js text content item.
 * Parses the fontName to determine bold, italic, and font family.
 */
const detectTextProperties = (item) => {
  const fontName = (item.fontName || '').toLowerCase();
  
  // Detect bold
  const isBold = /bold|black|heavy|demi|semibold/i.test(fontName);
  
  // Detect italic
  const isItalic = /italic|oblique|inclined|slanted/i.test(fontName);
  
  // Detect font family
  let fontFamily = 'Helvetica';
  if (/times|serif/i.test(fontName) && !/sans/i.test(fontName)) {
    fontFamily = 'TimesRoman';
  } else if (/courier|mono|consolas|menlo/i.test(fontName)) {
    fontFamily = 'Courier';
  } else if (/arial|helvetica|sans|gothic|verdana|tahoma|calibri|segoe/i.test(fontName)) {
    fontFamily = 'Helvetica';
  }
  // For fonts that don't match any pattern, default to Helvetica
  
  // Font size from transform matrix
  const fontSize = Math.round(Math.abs(item.transform[0]) || 12);
  
  return { fontFamily, isBold, isItalic, fontSize };
};

/**
 * Samples the rendered canvas at a text position to detect the text color.
 * Returns a hex color string.
 */
const sampleCanvasColor = (canvas, textX, textY, textWidth, textHeight, scale) => {
  if (!canvas) return '#000000';
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Sample a small area in the center of the text region (unscaled coords are already in canvas space)
  const sampleX = Math.round(textX + textWidth * 0.1);
  const sampleY = Math.round(textY - textHeight * 0.5);
  const sampleW = Math.max(1, Math.round(textWidth * 0.3));
  const sampleH = Math.max(1, Math.round(textHeight * 0.6));
  
  // Clamp to canvas bounds
  const x = Math.max(0, Math.min(sampleX, canvas.width - sampleW));
  const y = Math.max(0, Math.min(sampleY, canvas.height - sampleH));
  const w = Math.min(sampleW, canvas.width - x);
  const h = Math.min(sampleH, canvas.height - y);
  
  if (w <= 0 || h <= 0) return '#000000';
  
  try {
    const imageData = ctx.getImageData(x, y, w, h);
    const data = imageData.data;
    
    // Find the darkest (most colored) non-white pixel
    let bestR = 0, bestG = 0, bestB = 0;
    let bestDarkness = 255 * 3; // Start with white
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      
      // Skip transparent or near-white pixels
      if (a < 128) continue;
      if (r > 240 && g > 240 && b > 240) continue;
      
      const darkness = r + g + b;
      if (darkness < bestDarkness) {
        bestDarkness = darkness;
        bestR = r;
        bestG = g;
        bestB = b;
      }
    }
    
    // If all pixels were white/transparent, default to black
    if (bestDarkness >= 255 * 3) return '#000000';
    
    // Convert to hex
    const toHex = (c) => c.toString(16).padStart(2, '0');
    return `#${toHex(bestR)}${toHex(bestG)}${toHex(bestB)}`;
  } catch (e) {
    return '#000000';
  }
};

const PdfViewer = ({
  pdfDoc, pageNumber, mode, annotations, setAnnotations, commitAnnotations,
  selectedTextId, setSelectedTextId, currentColor, currentFont, currentFontSize,
  onFontSizeChange, currentBold, currentItalic, currentUnderline, currentAlignment,
  // New props
  scale,
  shapeType,
  strokeWidth,
  highlightColor,
  savedSignature,
  searchHighlights,
  currentSearchIndex,
  pageRotation,
  // Formatting sync callbacks
  onBoldChange,
  onItalicChange,
  onUnderlineChange,
  onAlignmentChange,
  onFontChange,
  onColorChange,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [viewport, setViewport] = useState(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);

  // Text input state
  const [textInputVisible, setTextInputVisible] = useState(false);
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [currentText, setCurrentText] = useState('');
  const [editingTextId, setEditingTextId] = useState(null);
  const inputRef = useRef(null);

  // Drag & Resize state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);
  const [croppingImageId, setCroppingImageId] = useState(null);
  const [cropStart, setCropStart] = useState(null);

  // Shape drawing state
  const [shapeStart, setShapeStart] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);

  // Highlight drawing state
  const [highlightStart, setHighlightStart] = useState(null);
  const [currentHighlight, setCurrentHighlight] = useState(null);

  // Comment tooltip
  const [hoveredComment, setHoveredComment] = useState(null);

  // Native Text
  const [pdfTextItems, setPdfTextItems] = useState([]);

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTextId && !textInputVisible && !editingTextId) {
        const newTexts = annotations.texts?.filter(t => t.id !== selectedTextId) || [];
        const newImages = annotations.images?.filter(img => img.id !== selectedTextId) || [];
        const newStamps = annotations.stamps?.filter(s => s.id !== selectedTextId) || [];
        const newSignatures = annotations.signatures?.filter(s => s.id !== selectedTextId) || [];
        const newComments = annotations.comments?.filter(c => c.id !== selectedTextId) || [];
        const newShapes = annotations.shapes?.filter(s => s.id !== selectedTextId) || [];
        commitAnnotations({ ...annotations, texts: newTexts, images: newImages, stamps: newStamps, signatures: newSignatures, comments: newComments, shapes: newShapes });
        setSelectedTextId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTextId, textInputVisible, editingTextId, annotations, commitAnnotations, setSelectedTextId]);

  // Render PDF page
  useEffect(() => {
    let renderTask;
    let isActive = true;

    const renderPage = async () => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isActive) return;

        const vp = page.getViewport({ scale, rotation: pageRotation || 0 });
        setViewport(vp);

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = vp.width;
        canvas.height = vp.height;

        const renderContext = {
          canvasContext: canvas.getContext('2d'),
          viewport: vp,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;

        const textContent = await page.getTextContent();
        setPdfTextItems(textContent.items);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(err);
        }
      }
    };

    renderPage();

    return () => {
      isActive = false;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, pageNumber, scale, pageRotation]);

  // ============ POINTER HANDLERS ============

  const handlePointerDown = (e) => {
    if (contextMenu) setContextMenu(null);

    if ((mode === 'select' || mode === 'erase') && e.target === containerRef.current) {
      setSelectedTextId(null);
      if (croppingImageId) setCroppingImageId(null);
      return;
    }

    if (mode === 'select' || mode === 'erase') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'draw') {
      setIsDrawing(true);
      setCurrentPath({ points: [{ x, y }], color: currentColor, width: strokeWidth });
      setSelectedTextId(null);
    } else if (mode === 'text') {
      if (textInputVisible) {
        saveText();
      } else {
        setTextInputPos({ x, y });
        setTextInputVisible(true);
        setCurrentText('');
        setSelectedTextId(null);
        setEditingTextId(null);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    } else if (mode === 'highlight') {
      setHighlightStart({ x, y });
      setCurrentHighlight({ x, y, width: 0, height: 20 * scale, color: highlightColor, opacity: 0.4 });
      setSelectedTextId(null);
    } else if (mode === 'shape') {
      setShapeStart({ x, y });
      setCurrentShape({ type: shapeType, x, y, width: 0, height: 0, color: currentColor, strokeWidth });
      setSelectedTextId(null);
    } else if (mode === 'stamp') {
      // Stamp placement is handled via App.jsx callback
    } else if (mode === 'signature') {
      if (savedSignature) {
        const newId = 'sig-' + Date.now();
        const currentAnn = annotations || { paths: [], texts: [], images: [], erasures: [], highlights: [], shapes: [], stamps: [], signatures: [], comments: [] };
        commitAnnotations({
          ...currentAnn,
          signatures: [...(currentAnn.signatures || []), {
            id: newId,
            dataUrl: savedSignature,
            x,
            y: y - 40,
            width: 180,
            height: 60,
          }]
        });
        setSelectedTextId(newId);
      }
    } else if (mode === 'comment') {
      const newId = 'comment-' + Date.now();
      const currentAnn = annotations || { paths: [], texts: [], images: [], erasures: [], highlights: [], shapes: [], stamps: [], signatures: [], comments: [] };
      commitAnnotations({
        ...currentAnn,
        comments: [...(currentAnn.comments || []), {
          id: newId,
          x,
          y,
          text: '',
          color: '#f59e0b',
          timestamp: Date.now(),
        }]
      });
      setSelectedTextId(newId);
    }
  };

  const handlePointerMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing && mode === 'draw') {
      setCurrentPath((prev) => ({
        ...prev,
        points: [...prev.points, { x, y }]
      }));
    } else if (highlightStart && mode === 'highlight') {
      const width = x - highlightStart.x;
      setCurrentHighlight(prev => ({
        ...prev,
        x: width >= 0 ? highlightStart.x : x,
        width: Math.abs(width),
      }));
    } else if (shapeStart && mode === 'shape') {
      const w = x - shapeStart.x;
      const h = y - shapeStart.y;
      setCurrentShape(prev => ({
        ...prev,
        x: w >= 0 ? shapeStart.x : x,
        y: h >= 0 ? shapeStart.y : y,
        width: Math.abs(w),
        height: Math.abs(h),
        endX: x,
        endY: y,
      }));
    } else if (draggingId && mode === 'select') {
      // Drag all draggable items
      const newTexts = annotations.texts?.map(t => t.id === draggingId ? { ...t, x: x - dragOffset.x, y: y - dragOffset.y } : t);
      const newImages = annotations.images?.map(img => img.id === draggingId ? { ...img, x: x - dragOffset.x, y: y - dragOffset.y } : img);
      const newStamps = annotations.stamps?.map(s => s.id === draggingId ? { ...s, x: x - dragOffset.x, y: y - dragOffset.y } : s);
      const newSignatures = annotations.signatures?.map(s => s.id === draggingId ? { ...s, x: x - dragOffset.x, y: y - dragOffset.y } : s);
      const newComments = annotations.comments?.map(c => c.id === draggingId ? { ...c, x: x - dragOffset.x, y: y - dragOffset.y } : c);
      const newShapes = annotations.shapes?.map(s => {
        if (s.id === draggingId) {
          const dx = (x - dragOffset.x) - s.x;
          const dy = (y - dragOffset.y) - s.y;
          return {
            ...s,
            x: x - dragOffset.x,
            y: y - dragOffset.y,
            endX: (s.endX || s.x + s.width) + dx,
            endY: (s.endY || s.y + s.height) + dy,
          };
        }
        return s;
      });
      setAnnotations({ ...annotations, texts: newTexts, images: newImages, stamps: newStamps, signatures: newSignatures, comments: newComments, shapes: newShapes });
    } else if (resizeStart && resizeStart.isText && mode === 'select') {
      const dx = x - resizeStart.clickX;
      let newX = resizeStart.x;
      let newWidth = resizeStart.width;
      let newFontSize = resizeStart.fontSize;

      if (['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(resizeStart.handle)) {
        if (resizeStart.handle.includes('left')) {
          newX = Math.min(resizeStart.x + resizeStart.width - 50, resizeStart.x + dx);
          newWidth = resizeStart.width - (newX - resizeStart.x);
        } else {
          newWidth = Math.max(50, resizeStart.width + dx);
        }
        const scaleRatio = newWidth / resizeStart.width;
        newFontSize = Math.max(8, resizeStart.fontSize * scaleRatio);
      } else {
        if (resizeStart.handle === 'left') {
          newX = Math.min(resizeStart.x + resizeStart.width - 50, resizeStart.x + dx);
          newWidth = resizeStart.width - (newX - resizeStart.x);
        } else if (resizeStart.handle === 'right') {
          newWidth = Math.max(50, resizeStart.width + dx);
        }
      }

      const newTexts = annotations.texts?.map(t =>
        t.id === resizeStart.textId ? { ...t, x: newX, width: newWidth, fontSize: newFontSize } : t
      );
      setAnnotations({ ...annotations, texts: newTexts });
    } else if (resizingId && mode === 'select') {
      const dx = x - resizeStart.clickX;
      const dy = y - resizeStart.clickY;

      let newX = resizeStart.x;
      let newY = resizeStart.y;
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;

      const isCorner = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(resizeStart.handle);
      const aspect = resizeStart.width / resizeStart.height;

      if (isCorner) {
        let proposedDx = dx;
        let proposedDy = dy;
        if (Math.abs(dx) > Math.abs(dy)) {
          proposedDy = proposedDx / aspect;
          if (resizeStart.handle.includes('left') !== resizeStart.handle.includes('top')) proposedDy = -proposedDy;
        } else {
          proposedDx = proposedDy * aspect;
          if (resizeStart.handle.includes('left') !== resizeStart.handle.includes('top')) proposedDx = -proposedDx;
        }
        if (resizeStart.handle.includes('left')) { newX = Math.min(resizeStart.x + resizeStart.width - 20, resizeStart.x + proposedDx); newWidth = resizeStart.width - (newX - resizeStart.x); }
        if (resizeStart.handle.includes('right')) newWidth = Math.max(20, resizeStart.width + proposedDx);
        if (resizeStart.handle.includes('top')) { newY = Math.min(resizeStart.y + resizeStart.height - 20, resizeStart.y + proposedDy); newHeight = resizeStart.height - (newY - resizeStart.y); }
        if (resizeStart.handle.includes('bottom')) newHeight = Math.max(20, resizeStart.height + proposedDy);
      } else {
        if (resizeStart.handle === 'left') { newX = Math.min(resizeStart.x + resizeStart.width - 20, resizeStart.x + dx); newWidth = resizeStart.width - (newX - resizeStart.x); }
        if (resizeStart.handle === 'right') newWidth = Math.max(20, resizeStart.width + dx);
        if (resizeStart.handle === 'top') { newY = Math.min(resizeStart.y + resizeStart.height - 20, resizeStart.y + dy); newHeight = resizeStart.height - (newY - resizeStart.y); }
        if (resizeStart.handle === 'bottom') newHeight = Math.max(20, resizeStart.height + dy);
      }

      // Apply to images or signatures
      const updateItem = (item) => item.id === resizingId ? { ...item, x: newX, y: newY, width: newWidth, height: newHeight } : item;
      const newImages = annotations.images?.map(updateItem);
      const newSignatures = annotations.signatures?.map(updateItem);
      setAnnotations({ ...annotations, images: newImages, signatures: newSignatures });
    } else if (cropStart && mode === 'select') {
      const dx = x - cropStart.clickX;
      const dy = y - cropStart.clickY;

      let newX = cropStart.x, newY = cropStart.y;
      let newWidth = cropStart.width, newHeight = cropStart.height;

      if (cropStart.handle.includes('left')) { newX = Math.min(cropStart.x + cropStart.width - 20, cropStart.x + dx); newWidth = cropStart.width - (newX - cropStart.x); }
      if (cropStart.handle.includes('right')) newWidth = Math.max(20, cropStart.width + dx);
      if (cropStart.handle.includes('top')) { newY = Math.min(cropStart.y + cropStart.height - 20, cropStart.y + dy); newHeight = cropStart.height - (newY - cropStart.y); }
      if (cropStart.handle.includes('bottom')) newHeight = Math.max(20, cropStart.height + dy);

      const newCropW = newWidth / cropStart.absW;
      const newCropH = newHeight / cropStart.absH;
      const newCropX = (newX - cropStart.absX) / cropStart.absW;
      const newCropY = (newY - cropStart.absY) / cropStart.absH;

      const newImages = annotations.images?.map(i => i.id === cropStart.imageId ? {
        ...i, x: newX, y: newY, width: newWidth, height: newHeight,
        cropPercentX: newCropX, cropPercentY: newCropY, cropPercentWidth: newCropW, cropPercentHeight: newCropH
      } : i);
      setAnnotations({ ...annotations, images: newImages });
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && mode === 'draw' && currentPath && currentPath.points.length > 0) {
      setIsDrawing(false);
      commitAnnotations({
        ...annotations,
        paths: [...(annotations.paths || []), currentPath]
      });
      setCurrentPath(null);
    }

    if (highlightStart && mode === 'highlight' && currentHighlight && currentHighlight.width > 5) {
      const newId = 'hl-' + Date.now();
      commitAnnotations({
        ...annotations,
        highlights: [...(annotations.highlights || []), { id: newId, ...currentHighlight }]
      });
    }
    setHighlightStart(null);
    setCurrentHighlight(null);

    if (shapeStart && mode === 'shape' && currentShape && (currentShape.width > 3 || currentShape.height > 3)) {
      const newId = 'shape-' + Date.now();
      commitAnnotations({
        ...annotations,
        shapes: [...(annotations.shapes || []), { id: newId, ...currentShape }]
      });
    }
    setShapeStart(null);
    setCurrentShape(null);

    if (draggingId || resizingId || cropStart) {
      setDraggingId(null);
      setResizingId(null);
      setCropStart(null);
      commitAnnotations(annotations);
    }
  };

  // ============ TEXT HANDLERS ============

  const saveText = () => {
    if (currentText.trim()) {
      if (editingTextId) {
        const newTexts = annotations.texts.map(t => t.id === editingTextId ? { ...t, text: currentText } : t);
        commitAnnotations({ ...annotations, texts: newTexts });
      } else {
        const newId = Date.now().toString();
        commitAnnotations({
          ...annotations,
          texts: [...(annotations.texts || []), {
            id: newId, text: currentText, x: textInputPos.x, y: textInputPos.y,
            fontFamily: currentFont, fontSize: currentFontSize, color: currentColor,
            isBold: currentBold, isItalic: currentItalic, isUnderline: currentUnderline, alignment: currentAlignment
          }]
        });
        setSelectedTextId(newId);
      }
    } else if (editingTextId) {
      const newTexts = annotations.texts.filter(t => t.id !== editingTextId);
      commitAnnotations({ ...annotations, texts: newTexts });
      if (selectedTextId === editingTextId) setSelectedTextId(null);
    }
    setTextInputVisible(false);
    setCurrentText('');
    setEditingTextId(null);
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveText(); }
    else if (e.key === 'Escape') { setTextInputVisible(false); setCurrentText(''); }
  };

  // ============ ERASER HANDLERS ============

  const handlePathPointerDown = (e, pathIndex) => {
    if (mode === 'erase') {
      e.stopPropagation();
      const newPaths = annotations.paths?.filter((_, i) => i !== pathIndex) || [];
      commitAnnotations({ ...annotations, paths: newPaths });
    }
  };

  const handleHighlightPointerDown = (e, hlId) => {
    if (mode === 'erase') {
      e.stopPropagation();
      const newHighlights = annotations.highlights?.filter(h => h.id !== hlId) || [];
      commitAnnotations({ ...annotations, highlights: newHighlights });
    } else if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(hlId);
    }
  };

  const handleShapePointerDown = (e, shapeItem) => {
    if (mode === 'erase') {
      e.stopPropagation();
      const newShapes = annotations.shapes?.filter(s => s.id !== shapeItem.id) || [];
      commitAnnotations({ ...annotations, shapes: newShapes });
    } else if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(shapeItem.id);
      const rect = containerRef.current.getBoundingClientRect();
      setDraggingId(shapeItem.id);
      setDragOffset({ x: e.clientX - rect.left - shapeItem.x, y: e.clientY - rect.top - shapeItem.y });
    }
  };

  // ============ ITEM HANDLERS ============

  const handleTextPointerDown = (e, textItem) => {
    if (e.target.dataset.isHandle) return;
    if (mode === 'erase') {
      e.stopPropagation();
      commitAnnotations({ ...annotations, texts: annotations.texts?.filter(t => t.id !== textItem.id) || [] });
      if (selectedTextId === textItem.id) setSelectedTextId(null);
      return;
    }
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(textItem.id);

      // Sync toolbar to reflect this text annotation's formatting
      if (onFontChange && textItem.fontFamily) onFontChange(textItem.fontFamily);
      if (onFontSizeChange && textItem.fontSize) onFontSizeChange(textItem.fontSize);
      if (onBoldChange) onBoldChange(!!textItem.isBold);
      if (onItalicChange) onItalicChange(!!textItem.isItalic);
      if (onUnderlineChange) onUnderlineChange(!!textItem.isUnderline);
      if (onAlignmentChange && textItem.alignment) onAlignmentChange(textItem.alignment);
      if (onColorChange && textItem.color) onColorChange(textItem.color);

      const rect = containerRef.current.getBoundingClientRect();
      setDraggingId(textItem.id);
      setDragOffset({ x: e.clientX - rect.left - textItem.x, y: e.clientY - rect.top - textItem.y });
    }
  };

  const handleTextDoubleClick = (e, textItem) => {
    e.stopPropagation();
    if (mode === 'select' || mode === 'text') {
      setEditingTextId(textItem.id);
      setCurrentText(textItem.text);
      setTextInputPos({ x: textItem.x, y: textItem.y });
      setTextInputVisible(true);
      setSelectedTextId(textItem.id);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleImagePointerDown = (e, imgItem) => {
    if (mode === 'erase') {
      e.stopPropagation();
      commitAnnotations({ ...annotations, images: annotations.images?.filter(img => img.id !== imgItem.id) || [] });
      if (selectedTextId === imgItem.id) setSelectedTextId(null);
      return;
    }
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(imgItem.id);
      const rect = containerRef.current.getBoundingClientRect();
      setDraggingId(imgItem.id);
      setDragOffset({ x: e.clientX - rect.left - imgItem.x, y: e.clientY - rect.top - imgItem.y });
    }
  };

  const handleStampPointerDown = (e, stamp) => {
    if (mode === 'erase') {
      e.stopPropagation();
      commitAnnotations({ ...annotations, stamps: annotations.stamps?.filter(s => s.id !== stamp.id) || [] });
      if (selectedTextId === stamp.id) setSelectedTextId(null);
      return;
    }
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(stamp.id);
      const rect = containerRef.current.getBoundingClientRect();
      setDraggingId(stamp.id);
      setDragOffset({ x: e.clientX - rect.left - stamp.x, y: e.clientY - rect.top - stamp.y });
    }
  };

  const handleSignaturePointerDown = (e, sig) => {
    if (mode === 'erase') {
      e.stopPropagation();
      commitAnnotations({ ...annotations, signatures: annotations.signatures?.filter(s => s.id !== sig.id) || [] });
      if (selectedTextId === sig.id) setSelectedTextId(null);
      return;
    }
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(sig.id);
      const rect = containerRef.current.getBoundingClientRect();
      setDraggingId(sig.id);
      setDragOffset({ x: e.clientX - rect.left - sig.x, y: e.clientY - rect.top - sig.y });
    }
  };

  const handleCommentPointerDown = (e, comment) => {
    if (mode === 'erase') {
      e.stopPropagation();
      commitAnnotations({ ...annotations, comments: annotations.comments?.filter(c => c.id !== comment.id) || [] });
      if (selectedTextId === comment.id) setSelectedTextId(null);
      return;
    }
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(comment.id);
      const rect = containerRef.current.getBoundingClientRect();
      setDraggingId(comment.id);
      setDragOffset({ x: e.clientX - rect.left - comment.x, y: e.clientY - rect.top - comment.y });
    }
  };

  // ============ RESIZE HANDLES ============

  const handleResizePointerDown = (e, item, handle) => {
    if (mode === 'select') {
      e.stopPropagation();
      setSelectedTextId(item.id);
      setResizingId(item.id);
      const rect = containerRef.current.getBoundingClientRect();
      setResizeStart({
        clickX: e.clientX - rect.left,
        clickY: e.clientY - rect.top,
        x: item.x, y: item.y,
        width: item.width, height: item.height,
        handle
      });
    }
  };

  const handleTextResizePointerDown = (e, textItem, handle) => {
    if (mode === 'select') {
      e.stopPropagation();
      setDraggingId(null);
      setSelectedTextId(textItem.id);
      const rect = containerRef.current.getBoundingClientRect();
      setResizeStart({
        clickX: e.clientX - rect.left,
        x: textItem.x, y: textItem.y,
        width: textItem.width || 200,
        fontSize: textItem.fontSize || currentFontSize || 16,
        handle, isText: true, textId: textItem.id
      });
    }
  };

  const handleContextMenu = (e, img) => {
    if (mode === 'select') {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, imageId: img.id });
    }
  };

  const handleCropPointerDown = (e, imgItem, handle) => {
    e.stopPropagation();
    setCroppingImageId(imgItem.id);
    const cropX = imgItem.cropPercentX ?? 0;
    const cropY = imgItem.cropPercentY ?? 0;
    const cropW = imgItem.cropPercentWidth ?? 1;
    const cropH = imgItem.cropPercentHeight ?? 1;
    const absW = imgItem.width / cropW;
    const absH = imgItem.height / cropH;
    const absX = imgItem.x - cropX * absW;
    const absY = imgItem.y - cropY * absH;
    const rect = containerRef.current.getBoundingClientRect();
    setCropStart({
      clickX: e.clientX - rect.left, clickY: e.clientY - rect.top,
      x: imgItem.x, y: imgItem.y, width: imgItem.width, height: imgItem.height,
      absX, absY, absW, absH, handle, imageId: imgItem.id
    });
  };

  // ============ RENDER HELPERS ============

  const resizeHandleStyle = (pos) => ({
    position: 'absolute', ...pos, width: 8, height: 8,
    backgroundColor: 'white', border: '1.5px solid #3b82f6',
    borderRadius: '50%', zIndex: 10
  });

  const renderResizeHandles = (item) => (
    <>
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'top-left')} style={resizeHandleStyle({ top: -4, left: -4, cursor: 'nwse-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'top-right')} style={resizeHandleStyle({ top: -4, right: -4, cursor: 'nesw-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'bottom-left')} style={resizeHandleStyle({ bottom: -4, left: -4, cursor: 'nesw-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'bottom-right')} style={resizeHandleStyle({ bottom: -4, right: -4, cursor: 'nwse-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'top')} style={resizeHandleStyle({ top: -4, left: 'calc(50% - 4px)', cursor: 'ns-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'bottom')} style={resizeHandleStyle({ bottom: -4, left: 'calc(50% - 4px)', cursor: 'ns-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'left')} style={resizeHandleStyle({ top: 'calc(50% - 4px)', left: -4, cursor: 'ew-resize' })} />
      <div onPointerDown={(e) => handleResizePointerDown(e, item, 'right')} style={resizeHandleStyle({ top: 'calc(50% - 4px)', right: -4, cursor: 'ew-resize' })} />
    </>
  );

  const renderTextResizeHandles = (t) => (
    <>
      {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'].map(handle => {
        const pos = {};
        if (handle.includes('top')) pos.top = -4;
        if (handle.includes('bottom')) pos.bottom = -4;
        if (handle === 'left' || handle === 'right') pos.top = 'calc(50% - 4px)';
        if (handle.includes('left') && !handle.includes('-')) pos.left = -4;
        if (handle.includes('right') && !handle.includes('-')) pos.right = -4;
        if (handle === 'top-left' || handle === 'bottom-left') pos.left = -4;
        if (handle === 'top-right' || handle === 'bottom-right') pos.right = -4;

        const cursors = {
          'top-left': 'nwse-resize', 'top-right': 'nesw-resize',
          'bottom-left': 'nesw-resize', 'bottom-right': 'nwse-resize',
          'left': 'ew-resize', 'right': 'ew-resize'
        };

        return (
          <div
            key={handle}
            data-is-handle="true"
            onPointerDown={(e) => handleTextResizePointerDown(e, t, handle)}
            style={resizeHandleStyle({ ...pos, cursor: cursors[handle] })}
          />
        );
      })}
    </>
  );

  // Shape SVG renderer
  const renderShapeSVG = (shape, isPreview = false) => {
    const { type, x, y, width, height, endX, endY, color, strokeWidth: sw } = shape;
    const stroke = color || '#ef4444';
    const swVal = sw || 3;

    if (type === 'rectangle') {
      return <rect x={x} y={y} width={width} height={height} fill="none" stroke={stroke} strokeWidth={swVal} />;
    } else if (type === 'circle') {
      const cx = x + width / 2;
      const cy = y + height / 2;
      return <ellipse cx={cx} cy={cy} rx={width / 2} ry={height / 2} fill="none" stroke={stroke} strokeWidth={swVal} />;
    } else if (type === 'line') {
      const sx = shape.startX ?? x;
      const sy = shape.startY ?? y;
      const ex = endX ?? (x + width);
      const ey = endY ?? (y + height);
      return <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={stroke} strokeWidth={swVal} strokeLinecap="round" />;
    } else if (type === 'arrow') {
      const sx = shape.startX ?? x;
      const sy = shape.startY ?? y;
      const ex = endX ?? (x + width);
      const ey = endY ?? (y + height);
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 12;
      return (
        <>
          <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={stroke} strokeWidth={swVal} strokeLinecap="round" />
          <line x1={ex} y1={ey} x2={ex - headLen * Math.cos(angle - Math.PI / 6)} y2={ey - headLen * Math.sin(angle - Math.PI / 6)} stroke={stroke} strokeWidth={swVal} strokeLinecap="round" />
          <line x1={ex} y1={ey} x2={ex - headLen * Math.cos(angle + Math.PI / 6)} y2={ey - headLen * Math.sin(angle + Math.PI / 6)} stroke={stroke} strokeWidth={swVal} strokeLinecap="round" />
        </>
      );
    }
    return null;
  };

  // ============ RENDER ============

  return (
    <div className="page-container" style={{ width: viewport?.width, height: viewport?.height }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      <div
        ref={containerRef}
        className={`interactive-overlay mode-${mode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          pointerEvents: ['select', 'draw', 'text', 'erase', 'highlight', 'shape', 'stamp', 'signature', 'comment'].includes(mode) ? 'auto' : 'none',
          userSelect: mode === 'select' || mode === 'text' ? 'auto' : 'none',
          touchAction: 'none'
        }}
      >
        {/* Search highlights */}
        {searchHighlights?.map((hl, i) => (
          <div
            key={`search-${i}`}
            className={`search-highlight ${i === currentSearchIndex ? 'active' : ''}`}
            style={{ left: hl.x, top: hl.y, width: hl.width, height: hl.height }}
          />
        ))}

        {/* SVG layer for paths, shapes */}
        <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
          {/* Drawing paths */}
          {annotations.paths?.map((path, i) => (
            <polyline
              key={`path-${i}`}
              onPointerDown={(e) => handlePathPointerDown(e, i)}
              points={path.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={path.color || '#ef4444'}
              strokeWidth={path.width || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: mode === 'erase' ? 'stroke' : 'none', cursor: mode === 'erase' ? 'pointer' : 'default' }}
            />
          ))}
          {currentPath && (
            <polyline
              points={currentPath.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={currentPath.color} strokeWidth={currentPath.width || 3}
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}

          {/* Shapes */}
          {annotations.shapes?.map((shape) => (
            <g key={shape.id}
              onPointerDown={(e) => handleShapePointerDown(e, shape)}
              style={{ pointerEvents: (mode === 'select' || mode === 'erase') ? 'auto' : 'none', cursor: mode === 'select' ? 'move' : mode === 'erase' ? 'pointer' : 'default' }}
            >
              {renderShapeSVG(shape)}
              {/* Invisible wider hit area for lines/arrows */}
              {(shape.type === 'line' || shape.type === 'arrow') && (
                <line
                  x1={shape.startX ?? shape.x} y1={shape.startY ?? shape.y}
                  x2={shape.endX ?? (shape.x + shape.width)} y2={shape.endY ?? (shape.y + shape.height)}
                  stroke="transparent" strokeWidth={Math.max(12, (shape.strokeWidth || 3) + 8)}
                />
              )}
            </g>
          ))}
          {currentShape && renderShapeSVG(currentShape, true)}
        </svg>

        {/* Highlights */}
        {annotations.highlights?.map((hl) => (
          <div
            key={hl.id}
            onPointerDown={(e) => handleHighlightPointerDown(e, hl.id)}
            style={{
              position: 'absolute', left: hl.x, top: hl.y,
              width: hl.width, height: hl.height,
              backgroundColor: hl.color || '#ffff00',
              opacity: hl.opacity || 0.4,
              borderRadius: 2,
              pointerEvents: (mode === 'select' || mode === 'erase') ? 'auto' : 'none',
              cursor: mode === 'erase' ? 'pointer' : mode === 'select' ? 'pointer' : 'default',
              border: selectedTextId === hl.id ? '1px solid rgba(59, 130, 246, 0.6)' : 'none'
            }}
          />
        ))}
        {currentHighlight && (
          <div style={{
            position: 'absolute', left: currentHighlight.x, top: currentHighlight.y,
            width: currentHighlight.width, height: currentHighlight.height,
            backgroundColor: currentHighlight.color || '#ffff00', opacity: 0.4,
            borderRadius: 2, pointerEvents: 'none'
          }} />
        )}

        {/* Erasures */}
        {annotations.erasures?.map(erase => (
          <div key={erase.id} style={{
            position: 'absolute', left: erase.x, top: erase.y,
            width: erase.width, height: erase.height,
            backgroundColor: 'white', pointerEvents: 'none'
          }} />
        ))}

        {/* Native PDF Text for Editing */}
        {pdfTextItems.map((item, i) => {
          const fontSize = item.transform[0] * scale;
          const x = item.transform[4] * scale;
          const y = viewport?.height ? viewport.height - (item.transform[5] * scale) : 0;
          const width = item.width * scale;
          const height = item.height * scale;

          return (
            <div key={`native-${i}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (mode !== 'select' && mode !== 'text') return;

                // Auto-detect formatting from the native PDF text item
                const detected = detectTextProperties(item);

                // Sample the canvas to detect text color
                const canvasX = item.transform[4] * scale;
                const canvasY = viewport?.height ? viewport.height - (item.transform[5] * scale) : 0;
                const detectedColor = sampleCanvasColor(
                  canvasRef.current,
                  canvasX, canvasY,
                  item.width * scale,
                  item.height * scale,
                  scale
                );

                const erasureId = `erase-${Date.now()}`;
                const newErasure = { id: erasureId, x, y: y - height * 1.2, width, height: height * 1.5 };
                const newTextId = `text-${Date.now()}`;
                const newText = {
                  id: newTextId, text: item.str, x, y,
                  fontFamily: detected.fontFamily,
                  fontSize: detected.fontSize,
                  color: detectedColor,
                  isBold: detected.isBold,
                  isItalic: detected.isItalic,
                  isUnderline: false,
                  alignment: 'left',
                  width: width + 20, // Give a bit of extra space for editing
                };

                // Sync toolbar to detected formatting
                onFontSizeChange(detected.fontSize);
                if (onFontChange) onFontChange(detected.fontFamily);
                if (onBoldChange) onBoldChange(detected.isBold);
                if (onItalicChange) onItalicChange(detected.isItalic);
                if (onUnderlineChange) onUnderlineChange(false);
                if (onAlignmentChange) onAlignmentChange('left');
                if (onColorChange) onColorChange(detectedColor);

                commitAnnotations({
                  ...annotations,
                  erasures: [...(annotations.erasures || []), newErasure],
                  texts: [...(annotations.texts || []), newText]
                });
                setEditingTextId(newTextId); setCurrentText(item.str);
                setTextInputPos({ x, y }); setTextInputVisible(true);
                setSelectedTextId(newTextId);
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
              style={{
                position: 'absolute', left: x, top: y, width, height,
                transform: 'translateY(-100%)',
                cursor: (mode === 'select' || mode === 'text') ? 'text' : 'default',
                pointerEvents: (mode === 'select' || mode === 'text') ? 'auto' : 'none',
                backgroundColor: 'transparent', color: 'transparent'
              }}
              title={mode === 'select' || mode === 'text' ? "Double click to edit" : undefined}
            >{item.str}</div>
          );
        })}

        {/* Images */}
        {annotations.images?.map((img) => {
          const isSelected = img.id === selectedTextId;
          const isCropping = croppingImageId === img.id;
          return (
            <div key={img.id}
              onPointerDown={(e) => handleImagePointerDown(e, img)}
              onContextMenu={(e) => handleContextMenu(e, img)}
              style={{
                position: 'absolute', left: img.x, top: img.y, width: img.width, height: img.height,
                pointerEvents: mode === 'select' ? 'auto' : 'none',
                cursor: mode === 'select' ? 'move' : 'default',
                border: isSelected && !isCropping ? '1px solid #3b82f6' : '1px solid transparent',
                userSelect: 'none'
              }}
            >
              {isCropping && (
                <img src={img.dataUrl} style={{
                  position: 'absolute',
                  width: `${100 / (img.cropPercentWidth ?? 1)}%`, height: `${100 / (img.cropPercentHeight ?? 1)}%`,
                  left: `-${(img.cropPercentX ?? 0) / (img.cropPercentWidth ?? 1) * 100}%`,
                  top: `-${(img.cropPercentY ?? 0) / (img.cropPercentHeight ?? 1) * 100}%`,
                  opacity: 0.5, pointerEvents: 'none'
                }} alt="crop context" draggable="false" />
              )}
              <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                <img src={img.dataUrl} alt="annotation" style={{
                  position: 'absolute',
                  width: `${100 / (img.cropPercentWidth ?? 1)}%`, height: `${100 / (img.cropPercentHeight ?? 1)}%`,
                  left: `-${(img.cropPercentX ?? 0) / (img.cropPercentWidth ?? 1) * 100}%`,
                  top: `-${(img.cropPercentY ?? 0) / (img.cropPercentHeight ?? 1) * 100}%`,
                  display: 'block', pointerEvents: 'none'
                }} draggable="false" />
              </div>
              {!isCropping && isSelected && mode === 'select' && renderResizeHandles(img)}
              {isCropping && (
                <>
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'].map(handle => {
                    const isCorner = handle.includes('-');
                    const style = { position: 'absolute', zIndex: 10 };
                    if (isCorner) {
                      style.width = 16; style.height = 16;
                      if (handle.includes('top')) { style.top = -4; style.borderTop = '3px solid black'; }
                      if (handle.includes('bottom')) { style.bottom = -4; style.borderBottom = '3px solid black'; }
                      if (handle.includes('left')) { style.left = -4; style.borderLeft = '3px solid black'; }
                      if (handle.includes('right')) { style.right = -4; style.borderRight = '3px solid black'; }
                    } else {
                      style.width = handle === 'top' || handle === 'bottom' ? 16 : 6;
                      style.height = handle === 'left' || handle === 'right' ? 16 : 6;
                      style.backgroundColor = 'black';
                      if (handle === 'top') { style.top = -3; style.left = 'calc(50% - 8px)'; }
                      if (handle === 'bottom') { style.bottom = -3; style.left = 'calc(50% - 8px)'; }
                      if (handle === 'left') { style.left = -3; style.top = 'calc(50% - 8px)'; }
                      if (handle === 'right') { style.right = -3; style.top = 'calc(50% - 8px)'; }
                    }
                    const cursors = { 'top-left': 'nwse-resize', 'top-right': 'nesw-resize', 'bottom-left': 'nesw-resize', 'bottom-right': 'nwse-resize', top: 'ns-resize', bottom: 'ns-resize', left: 'ew-resize', right: 'ew-resize' };
                    style.cursor = cursors[handle];
                    return <div key={handle} onPointerDown={(e) => handleCropPointerDown(e, img, handle)} style={style} />;
                  })}
                </>
              )}
            </div>
          );
        })}

        {/* Stamps */}
        {annotations.stamps?.map((stamp) => {
          const isSelected = stamp.id === selectedTextId;
          return (
            <div key={stamp.id}
              className="stamp-annotation"
              onPointerDown={(e) => handleStampPointerDown(e, stamp)}
              style={{
                left: stamp.x, top: stamp.y,
                color: stamp.color,
                borderColor: stamp.color,
                backgroundColor: stamp.bg || 'transparent',
                border: isSelected ? `3px solid ${stamp.color}` : `3px solid ${stamp.color}`,
                boxShadow: isSelected ? `0 0 0 2px rgba(59, 130, 246, 0.5)` : 'none',
                pointerEvents: (mode === 'select' || mode === 'erase') ? 'auto' : 'none',
              }}
            >
              {stamp.label}
            </div>
          );
        })}

        {/* Signatures */}
        {annotations.signatures?.map((sig) => {
          const isSelected = sig.id === selectedTextId;
          return (
            <div key={sig.id}
              onPointerDown={(e) => handleSignaturePointerDown(e, sig)}
              style={{
                position: 'absolute', left: sig.x, top: sig.y,
                width: sig.width, height: sig.height,
                pointerEvents: (mode === 'select' || mode === 'erase') ? 'auto' : 'none',
                cursor: mode === 'select' ? 'move' : 'default',
                border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                userSelect: 'none',
              }}
            >
              <img src={sig.dataUrl} alt="signature" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', objectFit: 'contain' }} draggable="false" />
              {isSelected && mode === 'select' && renderResizeHandles(sig)}
            </div>
          );
        })}

        {/* Comments / Sticky Notes */}
        {annotations.comments?.map((comment) => {
          const isSelected = comment.id === selectedTextId;
          const isHovered = hoveredComment === comment.id;
          return (
            <div key={comment.id}>
              <div
                className={`sticky-note ${isSelected ? 'selected' : ''}`}
                style={{ left: comment.x - 14, top: comment.y - 14 }}
                onPointerDown={(e) => handleCommentPointerDown(e, comment)}
                onMouseEnter={() => setHoveredComment(comment.id)}
                onMouseLeave={() => setHoveredComment(null)}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill={comment.color || '#f59e0b'} stroke="#000" strokeWidth="0.5">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              </div>
              {(isHovered || isSelected) && comment.text && (
                <div className="sticky-note-tooltip" style={{ left: comment.x + 18, top: comment.y - 4 }}>
                  {comment.text}
                </div>
              )}
            </div>
          );
        })}

        {/* Texts */}
        {annotations.texts?.map((t) => {
          if (t.id === editingTextId) return null;
          const isSelected = t.id === selectedTextId;
          return (
            <div key={t.id}
              onPointerDown={(e) => handleTextPointerDown(e, t)}
              onDoubleClick={(e) => handleTextDoubleClick(e, t)}
              style={{
                position: 'absolute', left: t.x, top: t.y,
                color: t.color || '#3b82f6',
                fontFamily: getFontFamilyCSS(t.fontFamily),
                fontSize: `${(t.fontSize || 16) * scale}px`,
                fontWeight: t.isBold ? 'bold' : 'normal',
                fontStyle: t.isItalic ? 'italic' : 'normal',
                textDecoration: t.isUnderline ? 'underline' : 'none',
                textAlign: t.alignment || 'left',
                pointerEvents: (mode === 'select' || mode === 'erase') ? 'auto' : 'none',
                cursor: mode === 'select' ? 'move' : 'default',
                transform: 'translateY(-100%)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                width: t.width ? `${t.width}px` : 'auto',
                padding: '2px',
                border: isSelected ? '1px dashed #3b82f6' : '1px solid transparent',
                borderRadius: '2px',
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                userSelect: 'none'
              }}
            >
              {t.text}
              {isSelected && mode === 'select' && renderTextResizeHandles(t)}
            </div>
          );
        })}

        {/* Text Input */}
        {textInputVisible && (() => {
          const editingText = editingTextId ? annotations.texts?.find(t => t.id === editingTextId) : null;
          const inputColor = editingText ? editingText.color : currentColor;
          const inputFont = editingText ? getFontFamilyCSS(editingText.fontFamily) : getFontFamilyCSS(currentFont);
          const inputFontSize = editingText ? editingText.fontSize : currentFontSize;
          const inputBold = editingText ? editingText.isBold : currentBold;
          const inputItalic = editingText ? editingText.isItalic : currentItalic;
          const inputUnderline = editingText ? editingText.isUnderline : currentUnderline;
          const inputAlignment = editingText ? editingText.alignment : currentAlignment;

          return (
            <textarea
              ref={inputRef}
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              onKeyDown={handleTextKeyDown}
              onBlur={saveText}
              style={{
                position: 'absolute', left: textInputPos.x, top: textInputPos.y,
                transform: 'translateY(-100%)',
                background: 'rgba(255, 255, 255, 0.95)',
                border: `2px solid ${inputColor}`,
                borderRadius: '4px', padding: '4px',
                color: inputColor, fontFamily: inputFont,
                fontSize: `${(inputFontSize || 16) * scale}px`,
                fontWeight: inputBold ? 'bold' : 'normal',
                fontStyle: inputItalic ? 'italic' : 'normal',
                textDecoration: inputUnderline ? 'underline' : 'none',
                textAlign: inputAlignment || 'left',
                outline: 'none', resize: 'none',
                minWidth: '150px',
                width: editingText?.width ? `${editingText.width}px` : 'auto',
                wordBreak: 'break-word', minHeight: '32px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                pointerEvents: 'auto'
              }}
              placeholder="Type and press Enter"
            />
          );
        })()}

        {/* Context Menu */}
        {contextMenu && (
          <div className="context-menu" style={{ left: contextMenu.x - containerRef.current.getBoundingClientRect().left, top: contextMenu.y - containerRef.current.getBoundingClientRect().top }}
            onPointerDown={(e) => e.stopPropagation()}>
            <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); setCroppingImageId(contextMenu.imageId); setContextMenu(null); setSelectedTextId(contextMenu.imageId); }}>
              Crop Image
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
