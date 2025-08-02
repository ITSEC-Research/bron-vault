"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useTheme } from "next-themes";

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
  const themeContext = useTheme();
  const resolvedTheme = themeContext?.resolvedTheme;
  const isInView = useInView(containerRef, { once: true, margin: "-50px" });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
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
      <div className="flex items-center justify-center h-[200px]">
        <span className="text-bron-text-muted">No browser data available</span>
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
              {tick}
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
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
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
                  background: "linear-gradient(to top, rgba(199, 0, 0, 0.8), rgba(255, 0, 0, 0.3))",
                  border: "2px solid rgba(255, 99, 99, 0.7)",
                  boxShadow: "0 0 12px rgba(255, 0, 0, 0.5)",
                }}
              >
                {/* Tooltip */}
                <motion.div
                  className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs text-white border border-white/10 shadow z-30 whitespace-nowrap pointer-events-none transition-opacity duration-300 ease-in-out ${
                    hoveredIndex === idx ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.9)",
                    backdropFilter: "blur(4px)",
                    top: barHeight < 30 ? "-40px" : "-32px", // Adjust position for small bars
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: hoveredIndex === idx ? 1 : 0, scale: hoveredIndex === idx ? 1 : 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  {item?.browser || 'Unknown'} <span className="font-bold">({item?.count || 0})</span>
                </motion.div>
              </motion.div>
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
    </div>
  );
}
