// components/common/TableSkeleton.jsx
"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function TableSkeleton({ cols, rows = 5 }) {
  return (
    <>
      {[...Array(rows)].map((_, r) => (
        <TableRow key={r}>
          {[...Array(cols)].map((__, c) => (
            <TableCell key={c}>
              <Skeleton className="h-6 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
