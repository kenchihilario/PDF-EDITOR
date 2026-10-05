import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, Loader } from 'lucide-react';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import PdfViewer from './components/PdfViewer';
import SearchBar from './components/SearchBar';
import SignaturePad from './components/SignaturePad';
import StampPicker from './components/StampPicker';
import CommentPanel from './components/CommentPanel';
import { exportPdf } from './utils/pdfEditor';

function App() {

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [mode, setMode] = useState('select');
  const [currentFont, setCurrentFont] = useState('Helvetica');
  const [currentFontSize, setCurrentFontSize] = useState(16);
  const [currentBold, setCurrentBold] = useState(false);
  const [currentItalic, setCurrentItalic] = useState(false);
  const [currentUnderline, setCurrentUnderline] = useState(false);
  const [currentAlignment, setCurrentAlignment] = useState('left');
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [shapeType, setShapeType] = useState('rectangle');
  const [highlightColor, setHighlightColor] = useState('#ffff00');

  const [zoomLevel, setZoomLevel] = useState(1.5);

  const [annotations, setAnnotations] = useState({});
  const [history, setHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);

  const [pageRotations, setPageRotations] = useState({});

  const [showSearch, setShowSearch] = useState(false);
  const [searchHighlights, setSearchHighlights] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState(null);
  const [showComments, setShowComments] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadPdf = useCallback(async (arrayBuffer) => {
    setIsLoading(true);
    setPdfFile(arrayBuffer.slice(0));
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setAnnotations({});
      setHistory([]);
      setRedoHistory([]);
      setSelectedTextId(null);
      setPageRotations({});
      setSearchHighlights([]);

      const thumbs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        thumbs.push(page);
      }
      setThumbnails(thumbs);
    } catch (error) {
      console.error("Error loading PDF:", error);
      alert("Failed to load PDF: " + (error.message || "Unknown error."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      await loadPdf(arrayBuffer);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        await loadPdf(arrayBuffer);
      } else {
        alert('Please drop a PDF file.');
      }
    }
  };

  const handleDownload = async () => {
    if (!pdfFile) return;
    setIsLoading(true);
    setSelectedTextId(null);
    try {
      const modifiedPdfBytes = await exportPdf(pdfFile, annotations, zoomLevel, pageRotations);
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'edited_document.pdf';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF: " + (err.message || err.toString()));
    } finally {
      setIsLoading(false);
    }
  };

  const updateAnnotations = (pageNum, newAnnotations) => {
    setAnnotations(prev => ({ ...prev, [pageNum]: newAnnotations }));
  };

  const commitAnnotations = (pageNum, newAnnotations) => {
    setHistory(prev => [...prev, annotations]);
    setRedoHistory([]);
    setAnnotations(prev => ({ ...prev, [pageNum]: newAnnotations }));
  };

  const handleUndo = () => {
    if (history.length > 0) {
      setRedoHistory(prev => [...prev, annotations]);
      setAnnotations(history[history.length - 1]);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleRedo = () => {
    if (redoHistory.length > 0) {
      setHistory(prev => [...prev, annotations]);
      setAnnotations(redoHistory[redoHistory.length - 1]);
      setRedoHistory(prev => prev.slice(0, -1));
    }
  };

  const updateSelectedText = (updates) => {
    if (!selectedTextId || !pdfDoc) return;
    const currentAnn = annotations[currentPage];
    if (!currentAnn) return;
    const newTexts = currentAnn.texts?.map(t => t.id === selectedTextId ? { ...t, ...updates } : t);
    if (newTexts) commitAnnotations(currentPage, { ...currentAnn, texts: newTexts });
  };

  const updateTextFont = (fontFamily) => { setCurrentFont(fontFamily); updateSelectedText({ fontFamily }); };
  const updateFontSize = (fontSize) => { setCurrentFontSize(fontSize); updateSelectedText({ fontSize }); };
  const updateBold = (isBold) => { setCurrentBold(isBold); updateSelectedText({ isBold }); };
  const updateItalic = (isItalic) => { setCurrentItalic(isItalic); updateSelectedText({ isItalic }); };
  const updateUnderline = (isUnderline) => { setCurrentUnderline(isUnderline); updateSelectedText({ isUnderline }); };
  const updateAlignment = (alignment) => { setCurrentAlignment(alignment); updateSelectedText({ alignment }); };
  const updateTextColor = (color) => { setCurrentColor(color); updateSelectedText({ color }); };

  const handleAddImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      let type = 'png';
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') type = 'jpg';

      const img = new Image();
      img.onload = () => {
        const maxWidth = 200;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) { height = (maxWidth / width) * height; width = maxWidth; }

        const newId = 'img-' + Date.now();
        const currentAnn = annotations[currentPage] || { paths: [], texts: [], images: [], erasures: [], highlights: [], shapes: [], stamps: [], signatures: [], comments: [] };
        commitAnnotations(currentPage, {
          ...currentAnn,
          images: [...(currentAnn.images || []), { id: newId, dataUrl, type, x: 100, y: 100, width, height }]
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleStampSelect = (stamp) => {
    setSelectedStamp(stamp);
    setMode('stamp');

    const newId = 'stamp-' + Date.now();
    const currentAnn = annotations[currentPage] || { paths: [], texts: [], images: [], erasures: [], highlights: [], shapes: [], stamps: [], signatures: [], comments: [] };
    commitAnnotations(currentPage, {
      ...currentAnn,
      stamps: [...(currentAnn.stamps || []), {
        id: newId,
        label: stamp.label,
        color: stamp.color,
        bg: stamp.bg,
        x: 150,
        y: 200,
      }]
    });
    setSelectedTextId(newId);
    setMode('select');
  };

  const handleSignatureSave = (dataUrl) => {
    setSavedSignature(dataUrl);
    setShowSignaturePad(false);
    setMode('signature');
  };

  const handleDeleteComment = (pageNum, commentId) => {
    const ann = annotations[pageNum];
    if (!ann) return;
    commitAnnotations(pageNum, {
      ...ann,
      comments: ann.comments?.filter(c => c.id !== commentId) || []
    });
  };

  const handleUpdateComment = (pageNum, commentId, text) => {
    const ann = annotations[pageNum];
    if (!ann) return;

    updateAnnotations(pageNum, {
      ...ann,
      comments: ann.comments?.map(c => c.id === commentId ? { ...c, text } : c) || []
    });
  };

  const handleAddBlankPage = async () => {
    if (!pdfFile) return;
    setIsLoading(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDocLib = await PDFDocument.load(pdfFile);
      const lastPage = pdfDocLib.getPages()[pdfDocLib.getPageCount() - 1];
      const { width, height } = lastPage.getSize();
      pdfDocLib.addPage([width, height]);
      const newBytes = await pdfDocLib.save();
      await loadPdf(newBytes.buffer);
    } catch (err) {
      console.error("Failed to add blank page:", err);
      alert("Failed to add page: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePage = async (pageNum) => {
    if (!pdfFile || numPages <= 1) return;
    setIsLoading(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDocLib = await PDFDocument.load(pdfFile);
      pdfDocLib.removePage(pageNum - 1);
      const newBytes = await pdfDocLib.save();

      const newAnnotations = {};
      for (const [key, value] of Object.entries(annotations)) {
        const p = Number(key);
        if (p < pageNum) newAnnotations[p] = value;
        else if (p > pageNum) newAnnotations[p - 1] = value;
      }
      setAnnotations(newAnnotations);

      await loadPdf(newBytes.buffer);
      if (currentPage > 1 && currentPage >= pageNum) setCurrentPage(Math.max(1, currentPage - 1));
    } catch (err) {
      console.error("Failed to delete page:", err);
      alert("Failed to delete page: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotatePage = (pageNum, degrees) => {
    setPageRotations(prev => ({
      ...prev,
      [pageNum]: ((prev[pageNum] || 0) + degrees + 360) % 360
    }));
  };

  const handleDuplicatePage = async (pageNum) => {
    if (!pdfFile) return;
    setIsLoading(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDocLib = await PDFDocument.load(pdfFile);
      const [copiedPage] = await pdfDocLib.copyPages(pdfDocLib, [pageNum - 1]);
      pdfDocLib.insertPage(pageNum, copiedPage);
      const newBytes = await pdfDocLib.save();
      await loadPdf(newBytes.buffer);
    } catch (err) {
      console.error("Failed to duplicate page:", err);
      alert("Failed to duplicate page: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReorderPages = async (fromPage, toPage) => {
    if (!pdfFile || fromPage === toPage) return;
    setIsLoading(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDocLib = await PDFDocument.load(pdfFile);
      const pages = pdfDocLib.getPages();

      const newDoc = await PDFDocument.create();
      const pageCount = pages.length;
      const order = Array.from({ length: pageCount }, (_, i) => i);

      const fromIdx = fromPage - 1;
      const toIdx = toPage - 1;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromIdx);

      const copiedPages = await newDoc.copyPages(pdfDocLib, order);
      for (const page of copiedPages) {
        newDoc.addPage(page);
      }

      const newBytes = await newDoc.save();
      await loadPdf(newBytes.buffer);
    } catch (err) {
      console.error("Failed to reorder pages:", err);
      alert("Failed to reorder pages: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHighlightMatches = (matches, activeIndex = 0) => {

    const pageMatches = matches.filter(m => m.pageNum === currentPage);
    const globalActiveIdx = activeIndex;
    let localActiveIdx = -1;

    let count = 0;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].pageNum === currentPage) {
        if (i === globalActiveIdx) {
          localActiveIdx = count;
        }
        count++;
      }
    }

    setSearchHighlights(pageMatches);
    setCurrentSearchIndex(localActiveIdx);
  };

  const handleSearchNavigateToPage = (pageNum) => {
    setCurrentPage(pageNum);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {

      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleUndo(); }
        else if (e.key === 'y') { e.preventDefault(); handleRedo(); }
        else if (e.key === 'f') { e.preventDefault(); setShowSearch(prev => !prev); }
        else if (e.key === 's') { e.preventDefault(); handleDownload(); }
        else if (e.key === 'o') {
          e.preventDefault();

          const input = document.querySelector('.toolbar .hidden-input[accept="application/pdf"]');
          if (input) input.click();
        }
        return;
      }

      if (!pdfDoc) return;

      switch (e.key.toLowerCase()) {
        case 'v': setMode('select'); break;
        case 't': setMode('text'); break;
        case 'd': setMode('draw'); break;
        case 'h': setMode('highlight'); break;
        case 'e': setMode('erase'); break;
        case 's': setMode('shape'); break;
        case 'c': setMode('comment'); break;
        case 'arrowleft':
          if (currentPage > 1) setCurrentPage(p => p - 1);
          break;
        case 'arrowright':
          if (currentPage < numPages) setCurrentPage(p => p + 1);
          break;
        case '=':
        case '+':
          setZoomLevel(z => Math.min(5, z + 0.25));
          break;
        case '-':
          setZoomLevel(z => Math.max(0.25, z - 0.25));
          break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfDoc, currentPage, numPages, annotations, history, redoHistory, pdfFile, zoomLevel]);

  const emptyAnn = { paths: [], texts: [], images: [], erasures: [], highlights: [], shapes: [], stamps: [], signatures: [], comments: [] };

  return (
    <div
      className="app-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isLoading && (
        <div className="loading-overlay">
          <Loader className="spinner" size={40} />
          <h2>Processing PDF...</h2>
        </div>
      )}

      <Toolbar
        mode={mode}
        setMode={setMode}
        onUpload={handleFileUpload}
        onDownload={handleDownload}
        hasDocument={!!pdfDoc}
        selectedTextId={selectedTextId}
        currentFont={currentFont}
        onFontChange={updateTextFont}
        currentFontSize={currentFontSize}
        onFontSizeChange={updateFontSize}
        currentBold={currentBold}
        onBoldChange={updateBold}
        currentItalic={currentItalic}
        onItalicChange={updateItalic}
        currentUnderline={currentUnderline}
        onUnderlineChange={updateUnderline}
        currentAlignment={currentAlignment}
        onAlignmentChange={updateAlignment}
        currentColor={currentColor}
        onColorChange={updateTextColor}
        onUndo={handleUndo}
        canUndo={history.length > 0}
        onRedo={handleRedo}
        canRedo={redoHistory.length > 0}
        onAddImage={handleAddImage}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={setCurrentPage}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        shapeType={shapeType}
        onShapeTypeChange={setShapeType}
        onToggleSearch={() => setShowSearch(prev => !prev)}
        onOpenStampPicker={() => setShowStampPicker(true)}
        onOpenSignaturePad={() => setShowSignaturePad(true)}
        onToggleComments={() => setShowComments(prev => !prev)}
        showComments={showComments}
        highlightColor={highlightColor}
        onHighlightColorChange={setHighlightColor}
        onAddBlankPage={handleAddBlankPage}
        onDeletePage={handleDeletePage}
        onRotatePage={handleRotatePage}
        onDuplicatePage={handleDuplicatePage}
      />

      {}
      {showSearch && pdfDoc && (
        <SearchBar
          pdfDoc={pdfDoc}
          scale={zoomLevel}
          onHighlightMatches={handleHighlightMatches}
          onNavigateToPage={handleSearchNavigateToPage}
          onClose={() => { setShowSearch(false); setSearchHighlights([]); }}
        />
      )}

      <div className="main-content">
        {pdfDoc ? (
          <>
            <Sidebar
              thumbnails={thumbnails}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageRotations={pageRotations}
              onAddBlankPage={handleAddBlankPage}
              onDeletePage={handleDeletePage}
              onRotatePage={handleRotatePage}
              onDuplicatePage={handleDuplicatePage}
              onReorderPages={handleReorderPages}
              numPages={numPages}
            />
            <div className="workspace">
              <PdfViewer
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                mode={mode}
                annotations={annotations[currentPage] || emptyAnn}
                setAnnotations={(ann) => updateAnnotations(currentPage, ann)}
                commitAnnotations={(ann) => commitAnnotations(currentPage, ann)}
                selectedTextId={selectedTextId}
                setSelectedTextId={setSelectedTextId}
                currentColor={currentColor}
                currentFont={currentFont}
                currentFontSize={currentFontSize}
                onFontSizeChange={updateFontSize}
                currentBold={currentBold}
                currentItalic={currentItalic}
                currentUnderline={currentUnderline}
                currentAlignment={currentAlignment}
                scale={zoomLevel}
                shapeType={shapeType}
                strokeWidth={strokeWidth}
                highlightColor={highlightColor}
                savedSignature={savedSignature}
                searchHighlights={searchHighlights}
                currentSearchIndex={currentSearchIndex}
                pageRotation={pageRotations[currentPage] || 0}
                onBoldChange={(v) => setCurrentBold(v)}
                onItalicChange={(v) => setCurrentItalic(v)}
                onUnderlineChange={(v) => setCurrentUnderline(v)}
                onAlignmentChange={(v) => setCurrentAlignment(v)}
                onFontChange={(v) => setCurrentFont(v)}
                onColorChange={(v) => setCurrentColor(v)}
              />
            </div>
            {showComments && (
              <CommentPanel
                annotations={annotations}
                currentPage={currentPage}
                onNavigateToPage={setCurrentPage}
                onDeleteComment={handleDeleteComment}
                onUpdateComment={handleUpdateComment}
              />
            )}
          </>
        ) : (
          <div className="workspace">
            <div className="empty-state">
              <label className={`upload-card ${isDragOver ? 'drag-active' : ''}`}>
                <Upload size={40} color="var(--accent-primary)" />
                <div>
                  <h3>Upload a PDF Document</h3>
                  <p>Drag and drop or click to browse</p>
                </div>
                <div className="upload-shortcuts">
                  <span className="shortcut-badge"><kbd>Ctrl+O</kbd> to open</span>
                  <span className="shortcut-badge">Drop PDF here</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden-input"
                  onChange={(e) => {
                    handleFileUpload(e);
                    e.target.value = null;
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {}
      {pdfDoc && (
        <div className="status-bar">
          <div className="status-bar-left">
            <span className="status-item">Page {currentPage} of {numPages}</span>
            <span className="status-item">Zoom: {Math.round(zoomLevel * 100)}%</span>
            {pageRotations[currentPage] ? <span className="status-item">Rotation: {pageRotations[currentPage]}°</span> : null}
          </div>
          <div className="status-bar-right">
            <span className="status-item">Mode: {mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            <span className="status-item">
              {Object.values(annotations).reduce((sum, ann) => {
                return sum + (ann.texts?.length || 0) + (ann.paths?.length || 0) + (ann.images?.length || 0)
                  + (ann.highlights?.length || 0) + (ann.shapes?.length || 0) + (ann.stamps?.length || 0)
                  + (ann.signatures?.length || 0) + (ann.comments?.length || 0);
              }, 0)} annotations
            </span>
          </div>
        </div>
      )}

      {}
      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {showStampPicker && (
        <StampPicker
          onSelect={handleStampSelect}
          onClose={() => setShowStampPicker(false)}
        />
      )}
    </div>
  );
}

export default App;
