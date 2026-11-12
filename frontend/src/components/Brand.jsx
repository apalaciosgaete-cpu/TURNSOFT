const COLORS = {
  deep: '#071B3A',
  tile: '#FFFFFF',
  accent: '#7DD3FC',
  highlight: '#F59E0B',
};

export function BrandMark({ size = 42, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="TURNSOFT"
    >
      <rect width="64" height="64" rx="16" fill={COLORS.deep} />
      <g fill={COLORS.tile}>
        <rect x="14" y="14" width="15" height="15" rx="4.5" />
        <rect x="35" y="14" width="15" height="15" rx="4.5" />
        <rect x="14" y="35" width="15" height="15" rx="4.5" />
      </g>
      <rect
        x="35"
        y="35"
        width="15"
        height="15"
        rx="4.5"
        fill={COLORS.accent}
        transform="rotate(45 42.5 42.5)"
      />
      <circle cx="32" cy="32" r="2.2" fill={COLORS.highlight} />
    </svg>
  );
}
