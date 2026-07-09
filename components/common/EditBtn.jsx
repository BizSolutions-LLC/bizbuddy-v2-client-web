// components/common/EditBtn.jsx
"use client";

import IconBtn from "./IconBtn";
import { Edit3 } from "lucide-react";

export default function EditBtn({ tooltip = "Edit", className = "", ...rest }) {
  return <IconBtn icon={Edit3} tooltip={tooltip} className={`text-orange-500 hover:bg-orange-500/10 ${className}`} {...rest} />;
}
