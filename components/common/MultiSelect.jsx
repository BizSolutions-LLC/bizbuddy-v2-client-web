// components/common/MultiSelect.jsx
"use client";

import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown, Search, ArrowDownAZ, ArrowUpZA } from "lucide-react";

export default function MultiSelect({
  options,
  selected,
  onChange,
  allLabel = "All",
  width = 200,
  icon: Icon,
  searchable = false,
  sortable = false,
  className = "",
}) {
  const allChecked = selected.includes("all") || selected.length === options.length;
  const triggerId = useId();
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  let displayOptions = [...options];

  if (sortable) {
    displayOptions.sort((a, b) => {
      const cmp = a.label.localeCompare(b.label);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  if (searchable && search.trim()) {
    displayOptions = displayOptions.filter((o) =>
      o.label.toLowerCase().includes(search.trim().toLowerCase())
    );
  }

  const Row = ({ label, checked, onClick }) => (
    <div
      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
      onClick={onClick}
    >
      <Checkbox checked={checked} className="h-4 w-4" />
      <span className="truncate text-sm">{label}</span>
    </div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          className={`min-w-[${width}px] justify-between ${className}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="truncate">
              {allChecked ? allLabel : `${selected.length} selected`}
            </span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 space-y-1" align="start">
        {(searchable || sortable) && (
          <div className="flex items-center gap-1 pb-2 border-b mb-1">
            {searchable && (
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            )}
            {sortable && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                title={sortDir === "asc" ? "A → Z (click for Z → A)" : "Z → A (click for A → Z)"}
              >
                {sortDir === "asc"
                  ? <ArrowDownAZ className="h-3.5 w-3.5" />
                  : <ArrowUpZA className="h-3.5 w-3.5" />
                }
              </Button>
            )}
          </div>
        )}
        {!search.trim() && (
          <Row label={allLabel} checked={allChecked} onClick={() => onChange("all")} />
        )}
        <div className="max-h-64 overflow-y-auto pr-1">
          {displayOptions.map((o) => (
            <Row
              key={o.value}
              label={o.label}
              checked={allChecked || selected.includes(o.value)}
              onClick={() => onChange(o.value)}
            />
          ))}
          {searchable && search.trim() && displayOptions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No results</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
