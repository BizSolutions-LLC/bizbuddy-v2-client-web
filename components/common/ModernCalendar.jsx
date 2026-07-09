// components/common/ModernCalendar.jsx
// Shared calendar grid — same visual design used across the app.
"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * ModernCalendar — generalized calendar grid.
 *
 * Props
 * ─────────────────────────────────────────────────────────────────────
 * selectedDate      Date            Currently selected date
 * onDateSelect      (Date) => void  Called when a cell is clicked
 * currentMonth      Date            Any date inside the month to display
 * onMonthChange     (Date) => void  Called with the new month on nav
 * loading           boolean         Disables cells while data is loading
 *
 * getDayIndicators  (Date) => Array<{ color: string }> | null
 *   Colored dots drawn at the bottom of each cell.
 *   ≤ 3 items  → individual dots.
 *   > 3 items  → replaced by an orange count badge.
 *
 * getDayTooltip     (Date) => ReactNode | null
 *   Content rendered inside the hover tooltip.
 *   When null the tooltip shows the formatted date only.
 *
 * getDayExtras      (Date) => ReactNode | null   (optional)
 *   Overlay rendered at the top-left of the cell (e.g. a globe icon).
 */
export default function ModernCalendar({
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  loading,
  getDayIndicators,
  getDayTooltip,
  getDayExtras,
}) {
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Leading padding from the previous month
  const prevMonthDays = [];
  for (let i = monthStart.getDay() - 1; i >= 0; i--) {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (i + 1));
    prevMonthDays.push(d);
  }

  // Trailing padding to reach exactly 42 cells (6 rows)
  const nextMonthDays = [];
  const remaining = 42 - (prevMonthDays.length + calendarDays.length);
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + i);
    nextMonthDays.push(d);
  }

  const allDays = [...prevMonthDays, ...calendarDays, ...nextMonthDays];

  const navigateMonth = (dir) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + dir);
    onMonthChange(d);
  };

  return (
    <div className="w-full">
      {/* Month navigation header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(-1)}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(1)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* Weekday header row */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800">
          {weekDays.map((d) => (
            <div
              key={d}
              className="p-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {allDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected     = isSameDay(day, selectedDate);
            const isTodayDate    = isToday(day);
            const indicators     = isCurrentMonth && getDayIndicators ? (getDayIndicators(day) || []) : [];
            const extras         = isCurrentMonth && getDayExtras    ? getDayExtras(day)          : null;
            const tooltipContent = getDayTooltip                     ? getDayTooltip(day)          : null;

            const cell = (
              <button
                onClick={() => onDateSelect(day)}
                disabled={loading}
                className={`
                  relative p-2 h-16 border-r border-b border-gray-200 dark:border-gray-700
                  transition-all duration-200 group w-full text-left
                  ${!isCurrentMonth
                    ? "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600"
                    : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }
                  ${isSelected
                    ? "bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-500 ring-inset"
                    : ""
                  }
                  ${isTodayDate && isCurrentMonth && !isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : ""
                  }
                `}
              >
                {/* Date number */}
                <div className={`text-sm font-medium mb-1 ${
                  isSelected
                    ? "text-orange-700 dark:text-orange-300"
                    : isTodayDate && isCurrentMonth
                    ? "text-blue-700 dark:text-blue-300"
                    : isCurrentMonth
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-600"
                }`}>
                  {day.getDate()}
                </div>

                {/* Bottom dot indicators */}
                {indicators.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1">
                    {indicators.length <= 3 ? (
                      <div className="flex gap-0.5 justify-center">
                        {indicators.map((ind, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${ind.color}`} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <div className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1 py-0.5 rounded">
                          {indicators.length}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Today pulsing dot (top-right) */}
                {isTodayDate && isCurrentMonth && (
                  <div className="absolute top-1 right-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}

                {/* Extra overlay (top-left, e.g. globe icon) */}
                {extras && (
                  <div className="absolute top-1 left-1">{extras}</div>
                )}
              </button>
            );

            return (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>{cell}</TooltipTrigger>
                  <TooltipContent>
                    {tooltipContent ?? (
                      <div className="text-sm font-medium">
                        {format(day, "MMM d, yyyy")}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
}
