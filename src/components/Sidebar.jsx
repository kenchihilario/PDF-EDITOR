import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, RotateCcw, Trash2, Copy, Plus } from 'lucide-react';

const Sidebar = ({ thumbnails, currentPage, setCurrentPage, pageRotations, onAddBlankPage, onDeletePage, onRotatePage, onDuplicatePage, onReorderPages, numPages }) => {
  const [draggedPage, setDraggedPage] = useState(null);
  const [dragOverPage, setDragOverPage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleDragStart = (e, pageNum) => {
    setDraggedPage(pageNum);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageNum.toString());
  };

  const handleDragOver = (e, pageNum) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPage(pageNum);
  };

  const handleDragLeave = () => {
    setDragOverPage(null);
  };

  const handleDrop = (e, targetPageNum) => {
    e.preventDefault();
    setDragOverPage(null);
    if (draggedPage !== null && draggedPage !== targetPageNum) {
      onReorderPages(draggedPage, targetPageNum);
    }
    setDraggedPage(null);
  };

  const handleDragEnd = () => {
    setDraggedPage(null);
    setDragOverPage(null);
  };

  const handleContextMenu = (e, pageNum) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pageNum });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>Pages ({thumbnails.length})</span>
        <button
          className="sidebar-add-btn"
          onClick={onAddBlankPage}
          title="Add Blank Page"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="thumbnails-container">
        {thumbnails.map((page, index) => {
          const pageNum = index + 1;
          const rotation = pageRotations?.[pageNum] || 0;
          return (
            <Thumbnail
              key={pageNum}
              page={page}
              pageNum={pageNum}
              rotation={rotation}
              isActive={pageNum === currentPage}
              isDragging={pageNum === draggedPage}
              isDragOver={pageNum === dragOverPage}
              onClick={() => setCurrentPage(pageNum)}
              onContextMenu={(e) => handleContextMenu(e, pageNum)}
              onDragStart={(e) => handleDragStart(e, pageNum)}
              onDragOver={(e) => handleDragOver(e, pageNum)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, pageNum)}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="sidebar-context-item" onClick={() => { onDuplicatePage(contextMenu.pageNum); setContextMenu(null); }}>
            <Copy size={14} /> Duplicate
          </button>
          <button className="sidebar-context-item" onClick={() => { onRotatePage(contextMenu.pageNum, 90); setContextMenu(null); }}>
            <RotateCw size={14} /> Rotate CW
          </button>
          <button className="sidebar-context-item" onClick={() => { onRotatePage(contextMenu.pageNum, -90); setContextMenu(null); }}>
            <RotateCcw size={14} /> Rotate CCW
          </button>
          <div className="sidebar-context-divider" />
          <button
            className="sidebar-context-item danger"
            onClick={() => { onDeletePage(contextMenu.pageNum); setContextMenu(null); }}
            disabled={numPages <= 1}
            style={{ opacity: numPages <= 1 ? 0.4 : 1 }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const Thumbnail = ({ page, pageNum, rotation, isActive, isDragging, isDragOver, onClick, onContextMenu, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let renderTask;
    const renderPage = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !page) return;

      const viewport = page.getViewport({ scale: 0.25, rotation: rotation || 0 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport: viewport,
      };

      try {
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Thumbnail render error:", err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [page, rotation]);

  const classNames = [
    'thumbnail-wrapper',
    isActive ? 'active' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <canvas ref={canvasRef} className="thumbnail-canvas" />
      {rotation !== 0 && (
        <span className="thumbnail-rotation-badge">{rotation}°</span>
      )}
      <span className="thumbnail-page-number">{pageNum}</span>
    </div>
  );
};

export default Sidebar;
