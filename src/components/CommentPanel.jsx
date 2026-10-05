import React, { useState } from 'react';
import { MessageSquare, X, Trash2, ChevronRight } from 'lucide-react';

const CommentPanel = ({ annotations, currentPage, onNavigateToPage, onDeleteComment, onUpdateComment }) => {
  const [expandedComment, setExpandedComment] = useState(null);

  const allComments = [];
  if (annotations) {
    for (const [pageNum, ann] of Object.entries(annotations)) {
      if (ann.comments) {
        for (const comment of ann.comments) {
          allComments.push({ ...comment, pageNum: Number(pageNum) });
        }
      }
    }
  }

  allComments.sort((a, b) => a.pageNum - b.pageNum || (a.timestamp || 0) - (b.timestamp || 0));

  const grouped = {};
  for (const c of allComments) {
    if (!grouped[c.pageNum]) grouped[c.pageNum] = [];
    grouped[c.pageNum].push(c);
  }

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <MessageSquare size={16} />
        <span>Comments ({allComments.length})</span>
      </div>

      <div className="comment-list">
        {allComments.length === 0 ? (
          <div className="comment-empty">
            <MessageSquare size={32} strokeWidth={1} />
            <p>No comments yet</p>
            <p className="comment-empty-hint">Use the Comment tool to add sticky notes to your document</p>
          </div>
        ) : (
          Object.entries(grouped).map(([pageNum, comments]) => (
            <div key={pageNum} className="comment-page-group">
              <div className="comment-page-label">Page {pageNum}</div>
              {comments.map(comment => (
                <div
                  key={comment.id}
                  className={`comment-card ${comment.pageNum === currentPage && expandedComment === comment.id ? 'expanded' : ''}`}
                  onClick={() => {
                    onNavigateToPage(Number(pageNum));
                    setExpandedComment(expandedComment === comment.id ? null : comment.id);
                  }}
                >
                  <div className="comment-card-header">
                    <div
                      className="comment-color-dot"
                      style={{ backgroundColor: comment.color || '#f59e0b' }}
                    />
                    <span className="comment-preview">
                      {comment.text?.substring(0, 40) || 'Empty note'}
                      {(comment.text?.length || 0) > 40 ? '...' : ''}
                    </span>
                    <ChevronRight size={14} className="comment-expand-icon" />
                  </div>
                  {expandedComment === comment.id && (
                    <div className="comment-card-body">
                      <textarea
                        value={comment.text || ''}
                        onChange={e => {
                          e.stopPropagation();
                          onUpdateComment(Number(pageNum), comment.id, e.target.value);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="comment-edit-textarea"
                        placeholder="Add a note..."
                      />
                      <div className="comment-card-actions">
                        <span className="comment-timestamp">
                          {comment.timestamp ? new Date(comment.timestamp).toLocaleString() : ''}
                        </span>
                        <button
                          className="btn btn-icon btn-danger-sm"
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteComment(Number(pageNum), comment.id);
                          }}
                          title="Delete comment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentPanel;
