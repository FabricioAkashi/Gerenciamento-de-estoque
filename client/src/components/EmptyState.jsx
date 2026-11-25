import React from 'react';

export function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
      {actionLabel && onAction && (
        <button className="secondary-button empty-state-action" onClick={onAction} type="button">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
