"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";

interface BrowserData {
  browser: string;
  count: number;
}

interface BrowserVerticalBarChartProps {
  browserData: BrowserData[];
  height?: number; // fallback if container doesn't provide height
}

export default function BrowserVerticalBarChart({
  browserData,
  height = 350,
}: BrowserVerticalBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(height);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const themeContext = useTheme();
  const resolvedTheme = themeContext?.resolvedTheme;
  const isInView = useInView(containerRef, { once: true, margin: "-50px" });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.height) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Safety check and early return if no data
  const safeBrowserData = Array.isArray(browserData) ? browserData.filter(item => item && typeof item.count === 'number') : []

  if (safeBrowserData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[450px]">
        <div className="text-center">
          <p className="text-muted-foreground">No browser data available</p>
          <p className="text-xs text-muted-foreground mt-2">Upload some stealer logs to see browser statistics</p>
        </div>
      </div>
    );
  }

  // Y Axis logic
  const maxCount = Math.max(...safeBrowserData.map(b => b?.count || 0), 1);
  const step = Math.ceil(maxCount / 5);
  const yTicks = Array.from({ length: 6 }, (_, i) => i * step);

  // Bar size calculation
  const barCount = safeBrowserData.length;
  const gapPercentage = 2;
  const totalGapWidth = (barCount - 1) * gapPercentage;
  const barWidthPercentage = (100 - totalGapWidth) / barCount;

  const chartAreaHeight = containerHeight - 40; // 40px reserved for label X axis

  // Theme-aware colors
  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(30,30,30,0.8)";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(30,30,30,0.08)";
  const gridColorV = isDark ? "rgba(255,255,255,0.05)" : "rgba(30,30,30,0.04)";
  const yAxisLineColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(30,30,30,0.2)";
  const xAxisLineColor = yAxisLineColor;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[300px] overflow-visible"
    >
      {/* Grid background */}
      <div className="absolute left-16 right-2 bottom-[40px] top-0 z-0 pointer-events-none">
        {yTicks.slice(0, -1).map((tick, i) => (
          <div
            key={"h-" + i}
            className="absolute left-0 right-0 border-t border-dashed"
            style={{
              top: `${(1 - tick / maxCount) * chartAreaHeight}px`,
              borderColor: gridColor,
            }}
          />
        ))}
        {safeBrowserData.map((item, idx) => {
          if (idx === 0) return null;
          return (
            <div
              key={"v-" + idx}
              className="absolute top-0 bottom-0 border-l border-dashed"
              style={{
                left: `calc(${(barWidthPercentage + gapPercentage) * idx}% )`,
                borderColor: gridColorV,
              }}
            />
          );
        })}
      </div>

      {/* Y Axis Ticks */}
      <div className="absolute top-0 bottom-[40px] left-0 flex flex-col justify-between z-10">
        {yTicks.slice().reverse().map((tick, i) => (
          <div key={i} className="flex items-center h-0.5">
            <span className="text-xs w-12 text-right pr-2 select-none" style={{ minWidth: 40, color: textColor }}>
              {Number(tick).toLocaleString()}
            </span>
            <div className="flex-1 border-t border-dashed" style={{ borderColor: gridColor }} />
          </div>
        ))}
      </div>

      {/* Y Axis vertical line */}
      <div className="absolute left-12 top-0 bottom-[40px] w-px z-0" style={{ background: yAxisLineColor }} />

      {/* Chart bars */}
      <div className="absolute left-16 right-2 bottom-[40px] top-0 flex items-end">
        {safeBrowserData.map((item, idx) => {
          const barHeight = ((item?.count || 0) / maxCount) * chartAreaHeight;

          return (
            <div
              key={item?.browser || `browser-${idx}`}
              className="flex flex-col items-center justify-end relative group"
              style={{
                width: `${barWidthPercentage}%`,
                marginRight: idx < barCount - 1 ? `${gapPercentage}%` : "0",
                minHeight: "20px", // Minimum hover area
              }}
              onMouseEnter={(e) => {
                setHoveredIndex(idx);
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPosition({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8
                });
              }}
              onMouseMove={(e) => {
                if (hoveredIndex === idx) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8
                  });
                }
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
                setTooltipPosition(null);
              }}
            >
              {/* Invisible hover area for small bars */}
              <div
                className="absolute bottom-0 left-0 right-0 cursor-pointer z-10"
                style={{
                  height: Math.max(barHeight, 20), // Minimum 20px hover area
                }}
              />

              <motion.div
                className="w-full rounded-t-md transition-all duration-300 relative cursor-pointer"
                initial={{ height: 0, opacity: 0 }}
                animate={isInView ? {
                  height: `${Math.max(barHeight, 8)}px`, // Minimum 8px visual height
                  opacity: 1
                } : {
                  height: 0,
                  opacity: 0
                }}
                transition={{
                  duration: 1.2,
                  delay: idx * 0.2,
                  type: "spring",
                  stiffness: 80,
                  damping: 15
                }}
                style={{
                  background: "linear-gradient(to top, rgba(255, 51, 51, 0.5), rgba(255, 51, 51, 0.1))",
                  border: "1px solid rgba(255, 51, 51, 0.3)",
                  boxShadow: "0 0 20px rgba(255, 51, 51, 0.15)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X Axis horizontal line */}
      <div className="absolute left-12 right-2 bottom-[40px] border-t z-10" style={{ borderColor: xAxisLineColor }} />

      {/* X Axis labels */}
      <div className="absolute bottom-0 left-16 right-2 flex">
        {safeBrowserData.map((item, idx) => {
          const browserWords = (item?.browser || 'Unknown').split(" ");
          const displayName = browserWords.length > 1 ? browserWords.join("\n") : (item?.browser || 'Unknown');

          return (
            <div
              key={`label-${item?.browser || 'unknown'}-${idx}`}
              className="flex flex-col items-center"
              style={{
                width: `${barWidthPercentage}%`,
                marginRight: idx < barCount - 1 ? `${gapPercentage}%` : "0",
              }}
            >
              <div
                className="mt-2 text-xs text-center truncate"
                style={{
                  maxWidth: "100%",
                  transform: barCount > 5 ? "rotate(-45deg)" : "none",
                  whiteSpace: barCount > 5 ? "pre-line" : "normal",
                  lineHeight: barCount > 5 ? "1.2" : "normal",
                  color: textColor,
                }}
                title={item?.browser || 'Unknown'}
              >
                {displayName}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip with React Portal - ensures it's not clipped by overflow-hidden */}
      {typeof window !== "undefined" && hoveredIndex !== null && tooltipPosition && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="px-2 py-1 rounded text-xs text-white border border-white/10 shadow-lg whitespace-nowrap"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                backdropFilter: "blur(4px)",
              }}
            >
              {safeBrowserData[hoveredIndex]?.browser || 'Unknown'} <span className="font-bold">({Number(safeBrowserData[hoveredIndex]?.count || 0).toLocaleString()})</span>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
