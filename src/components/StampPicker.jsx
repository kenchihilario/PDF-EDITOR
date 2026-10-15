import React from 'react';

const STAMPS = [
  { id: 'approved', label: 'APPROVED', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)', borderColor: '#16a34a' },
  { id: 'rejected', label: 'REJECTED', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', borderColor: '#dc2626' },
  { id: 'draft', label: 'DRAFT', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', borderColor: '#2563eb' },
  { id: 'confidential', label: 'CONFIDENTIAL', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)', borderColor: '#9333ea' },
  { id: 'final', label: 'FINAL', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', borderColor: '#059669' },
  { id: 'void', label: 'VOID', color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.12)', borderColor: '#b91c1c' },
  { id: 'for-review', label: 'FOR REVIEW', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', borderColor: '#d97706' },
  { id: 'preliminary', label: 'PRELIMINARY', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', borderColor: '#0891b2' },
  { id: 'not-approved', label: 'NOT APPROVED', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)', borderColor: '#e11d48' },
  { id: 'sign-here', label: 'SIGN HERE', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', borderColor: '#7c3aed' },
  { id: 'urgent', label: 'URGENT', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)', borderColor: '#ea580c' },
  { id: 'copy', label: 'COPY', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', borderColor: '#6b7280' },
];

const StampPicker = ({ onSelect, onClose }) => {
  return (
    <div className="stamp-picker-overlay" onClick={onClose}>
      <div className="stamp-picker" onClick={e => e.stopPropagation()}>
        <div className="stamp-picker-header">
          <h4>Select a Stamp</h4>
        </div>
        <div className="stamp-grid">
          {STAMPS.map(stamp => (
            <button
              key={stamp.id}
              className="stamp-item"
              onClick={() => {
                onSelect(stamp);
                onClose();
              }}
              style={{
                color: stamp.color,
                backgroundColor: stamp.bg,
                borderColor: stamp.borderColor,
              }}
            >
              {stamp.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { STAMPS };
export default StampPicker;
