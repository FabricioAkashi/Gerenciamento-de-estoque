import React from 'react';
import { AnimatedCounter } from './arc/animated-counter/animated-counter.tsx';

export function MetricCard({
  label,
  value,
  numericValue,
  prefix = '',
  suffix = '',
  decimals = 0,
  change,
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

  const possuiNumero = typeof numericValue === 'number' && Number.isFinite(numericValue);

  const content = (
    <>
      <div className="metric-top">
        <span>{label}</span>
        {change && <small className="metric-change">{change}</small>}
      </div>
      <div className="metric-value">
        {possuiNumero ? (
          <AnimatedCounter
            decimals={decimals}
            locale="pt-BR"
            prefix={prefix}
            suffix={suffix}
            value={numericValue}
          />
        ) : (
          <strong>{value ?? '-'}</strong>
        )}
      </div>
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
