"use client";

interface IdBarcodeProps {
  code?: string;
  className?: string;
}

export default function IdBarcode({
  code = "NITIN-SHUKLA-DEV-2026",
  className = "h-4 sm:h-[18px] w-auto",
}: IdBarcodeProps) {
  // Realistic Code 128 / Code 39 authentic bar pattern
  // Widths: 1 (narrow), 1.5, 2 (medium), 2.5, 3 (wide)
  const bars = [
    // Quiet zone & Start guard
    { x: 0, w: 2 },
    { x: 3, w: 1 },
    { x: 5, w: 3 },
    // Data sequence
    { x: 10, w: 1 },
    { x: 12, w: 2 },
    { x: 15.5, w: 1 },
    { x: 18, w: 3 },
    { x: 22.5, w: 1.5 },
    { x: 25.5, w: 1 },
    { x: 28, w: 2.5 },
    { x: 32, w: 1 },
    { x: 34.5, w: 2 },
    { x: 38, w: 3 },
    { x: 42.5, w: 1 },
    { x: 45, w: 1.5 },
    { x: 48, w: 2.5 },
    { x: 52, w: 1 },
    { x: 54.5, w: 3 },
    { x: 59, w: 1.5 },
    { x: 62, w: 1 },
    { x: 64.5, w: 2 },
    { x: 68, w: 3 },
    { x: 72.5, w: 1 },
    { x: 75, w: 2.5 },
    { x: 79, w: 1 },
    { x: 81.5, w: 1.5 },
    { x: 84.5, w: 3 },
    { x: 89, w: 2 },
    { x: 92.5, w: 1 },
    { x: 95, w: 2.5 },
    { x: 99, w: 1 },
    // Stop guard & Quiet zone
    { x: 102, w: 3 },
    { x: 106.5, w: 1 },
    { x: 109, w: 2 },
  ];

  return (
    <svg
      viewBox="0 0 112 18"
      fill="currentColor"
      className={`${className} text-primary/70 dark:text-primary/60 hover:text-primary transition-colors select-none`}
      aria-label={`Developer ID Barcode: ${code}`}
      role="img"
      shapeRendering="crispEdges"
    >
      <title>{`ID Barcode ${code}`}</title>
      {bars.map((bar, idx) => (
        <rect
          key={idx}
          x={bar.x}
          y={0}
          width={bar.w}
          height={18}
          rx={0.2}
        />
      ))}
    </svg>
  );
}
