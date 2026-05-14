import React from 'react';

export function MetricCard({ label, value, tone }) {
  return (
    <section className={`metric metric-${tone || 'neutral'}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
