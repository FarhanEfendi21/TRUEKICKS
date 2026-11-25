import { useMemo, useState } from "react";
import { formatRupiah, formatRangeLabel } from "../../lib/pricing";

export default function RevenueChart({
  daily = [],
  monthly = [],
  pick,
}) {
  const [granularity, setGranularity] = useState("daily");
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const series = useMemo(
    () => (granularity === "daily" ? daily : monthly),
    [granularity, daily, monthly]
  );

  const stats = useMemo(() => {
    const totalRevenue = series.reduce((sum, pt) => sum + (Number(pt.revenue) || 0), 0);
    const totalOrders = series.reduce((sum, pt) => sum + (Number(pt.orders) || 0), 0);
    const maxRevenue = Math.max(
      1,
      ...series.map((pt) => Number(pt.revenue) || 0)
    );
    return { totalRevenue, totalOrders, maxRevenue };
  }, [series]);

  const activePoint =
    hoveredIdx != null && series[hoveredIdx] ? series[hoveredIdx] : null;

  const chartHeight = 190;
  const chartWidth = 640;
  const padTop = 18;
  const padBottom = 28;
  const padLeft = 52;
  const padRight = 14;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;

  const yTicks = [0, 0.5, 1].map((ratio) => ({
    ratio,
    value: Math.round(stats.maxRevenue * ratio),
    y: padTop + innerHeight - ratio * innerHeight,
  }));

  const count = Math.max(1, series.length);
  const slotWidth = innerWidth / count;
  const barWidth = Math.min(34, Math.max(10, slotWidth * 0.54));

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 sm:p-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800/80">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            {pick("Analitik Pendapatan", "Revenue Analytics")}
          </p>
          <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white tabular-nums">
              {formatRupiah(activePoint ? activePoint.revenue : stats.totalRevenue)}
            </h2>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
              {activePoint
                ? `${activePoint.label} · ${activePoint.orders} ${pick("pesanan", "orders")}`
                : `${stats.totalOrders} ${pick("pesanan terkonfirmasi", "confirmed orders")} · ${
                    granularity === "daily"
                      ? pick("14 hari terakhir", "Last 14 days")
                      : pick("6 bulan terakhir", "Last 6 months")
                  }`}
            </span>
          </div>
        </div>

        {/* Period Switcher */}
        <div className="inline-flex items-center self-start rounded-lg bg-gray-100 dark:bg-gray-800/80 p-0.5 border border-gray-200/70 dark:border-gray-800">
          <button
            type="button"
            onClick={() => {
              setGranularity("daily");
              setHoveredIdx(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              granularity === "daily"
                ? "bg-white dark:bg-gray-950 text-gray-950 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {pick("Harian (14H)", "Daily (14D)")}
          </button>
          <button
            type="button"
            onClick={() => {
              setGranularity("monthly");
              setHoveredIdx(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              granularity === "monthly"
                ? "bg-white dark:bg-gray-950 text-gray-950 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {pick("Bulanan (6B)", "Monthly (6M)")}
          </button>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="mt-5 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[440px] h-52 select-none"
          role="img"
          aria-label={pick("Grafik omzet TrueKicks", "TrueKicks revenue chart")}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Horizontal Y-Axis Hairlines */}
          {yTicks.map((tick) => (
            <g key={tick.ratio}>
              <line
                x1={padLeft}
                x2={chartWidth - padRight}
                y1={tick.y}
                y2={tick.y}
                className="stroke-gray-100 dark:stroke-gray-800"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-gray-400 text-[10px] font-medium"
              >
                {tick.value === 0 ? "0" : formatRangeLabel(tick.value)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {series.map((pt, idx) => {
            const val = Math.max(0, Number(pt.revenue) || 0);
            const barH =
              val > 0 ? Math.max(4, (val / stats.maxRevenue) * innerHeight) : 2;
            const x = padLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
            const y = padTop + innerHeight - barH;
            const isHovered = hoveredIdx === idx;
            const showLabel =
              granularity === "monthly" ||
              idx === 0 ||
              idx === series.length - 1 ||
              idx % 2 === 0;

            return (
              <g
                key={pt.date || pt.month || idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onFocus={() => setHoveredIdx(idx)}
                tabIndex={0}
              >
                {/* Invisible wider hit zone */}
                <rect
                  x={padLeft + idx * slotWidth}
                  y={padTop}
                  width={slotWidth}
                  height={innerHeight + padBottom}
                  fill="transparent"
                />

                {/* Bar column */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx="4"
                  className={
                    val === 0
                      ? "fill-gray-200/70 dark:fill-gray-800"
                      : isHovered
                        ? "fill-[#FF5500] transition-colors duration-150"
                        : "fill-gray-900 dark:fill-gray-100 transition-colors duration-150"
                  }
                />

                {/* X-Axis label */}
                {showLabel && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    className={`text-[10px] font-medium ${
                      isHovered
                        ? "fill-gray-950 dark:fill-white font-semibold"
                        : "fill-gray-400"
                    }`}
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
