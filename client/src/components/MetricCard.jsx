import React from 'react';

export function MetricCard({
  label,
  value,
  tone = 'neutral',
  helper,
  onClick,
  active = false,
  highlighted = false
}) {
  const classes = [
    'metric',
    `metric-${tone}`,
    onClick ? 'metric-interactive' : '',
    active ? 'is-active' : '',
    highlighted ? 'is-highlighted' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small className="metric-helper">{helper}</small>}
    </>
  );

  if (onClick) {
    return (
      <button aria-pressed={active} className={classes} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <section className={classes}>{content}</section>;
}
