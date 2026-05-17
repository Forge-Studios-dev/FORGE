import type { CSSProperties } from 'react';

export function Icon({
  name,
  filled,
  className = '',
  style,
}: {
  name: string;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={
        filled
          ? { ...style, fontVariationSettings: "'FILL' 1" }
          : style
      }
      aria-hidden
    >
      {name}
    </span>
  );
}
