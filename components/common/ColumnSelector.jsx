// components/common/ColumnSelector.jsx
"use client";

import MultiSelect from "./MultiSelect";

export default function ColumnSelector({ options, visible, setVisible }) {
  const handle = (val) => {
    if (val === "all") {
      setVisible(visible.length === options.length ? [] : options.map((o) => o.value));
    } else {
      setVisible(visible.includes(val) ? visible.filter((x) => x !== val) : [...visible, val]);
    }
  };

  return <MultiSelect options={options} selected={visible} onChange={handle} allLabel="All Columns" width={200} />;
}
