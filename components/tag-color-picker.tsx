"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PALETTE = [
  { name: "red-500", hex: "#ef4444" },
  { name: "blue-500", hex: "#3b82f6" },
  { name: "green-500", hex: "#22c55e" },
  { name: "amber-500", hex: "#f59e0b" },
  { name: "purple-500", hex: "#a855f7" },
  { name: "slate-500", hex: "#64748b" },
];

interface TagColorPickerProps {
  value?: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TagColorPicker({
  value,
  onChange,
  disabled,
  className,
}: TagColorPickerProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {PALETTE.map((color) => {
        const isSelected = value === color.hex;
        return (
          <button
            key={color.hex}
            type="button"
            disabled={disabled}
            onClick={() => onChange(color.hex)}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95",
              isSelected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100",
              disabled && "opacity-50 cursor-not-allowed hover:scale-100"
            )}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
