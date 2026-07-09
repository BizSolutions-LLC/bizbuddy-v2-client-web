// components/DateTimePicker.jsx

"use client";

import React, { useState, useEffect } from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function DateTimePicker({ value, onChange, placeholder }) {
  const [date, setDate] = useState(value ? new Date(value) : null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value) setDate(new Date(value));
  }, [value]);

  const handleDateSelect = (selectedDate) => {
    const newDate = selectedDate ? new Date(selectedDate) : new Date();
    if (date) {
      newDate.setHours(date.getHours(), date.getMinutes());
    } else {
      newDate.setHours(0, 0);
    }
    setDate(newDate);
    onChange(newDate.toISOString());
  };

  const setHour = (hour) => {
    if (!date) {
      const tempDate = new Date();
      tempDate.setHours(hour, 0);
      setDate(tempDate);
      onChange(tempDate.toISOString().slice(0, 16));
      return;
    }
    const newDate = new Date(date);
    const isPM = newDate.getHours() >= 12;
    newDate.setHours((isPM ? 12 : 0) + (hour % 12));
    setDate(newDate);
    onChange(newDate.toISOString());
  };

  const setMinute = (minute) => {
    if (!date) {
      const tempDate = new Date();
      tempDate.setMinutes(minute);
      setDate(tempDate);
      onChange(tempDate.toISOString().slice(0, 16));
      return;
    }
    const newDate = new Date(date);
    newDate.setMinutes(minute);
    setDate(newDate);
    onChange(newDate.toISOString());
  };

  const setAmPm = (ampm) => {
    if (!date) return;
    const newDate = new Date(date);
    let hours = newDate.getHours();
    if (ampm === "AM" && hours >= 12) hours -= 12;
    if (ampm === "PM" && hours < 12) hours += 12;
    newDate.setHours(hours);
    setDate(newDate);
    onChange(newDate.toISOString());
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MM/dd/yyyy hh:mm aa") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
          <div className="flex flex-row divide-x border-t sm:border-t-0 sm:divide-x">
            <ScrollArea className="h-[200px] w-[70px]">
              <div className="flex flex-col p-2 gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                  <Button
                    key={hour}
                    size="sm"
                    variant={date && (date.getHours() % 12 || 12) === hour ? "default" : "ghost"}
                    onClick={() => setHour(hour % 12)}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
            <ScrollArea className="h-[200px] w-[70px]">
              <div className="flex flex-col p-2 gap-1">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                  <Button
                    key={minute}
                    size="sm"
                    variant={date && date.getMinutes() === minute ? "default" : "ghost"}
                    onClick={() => setMinute(minute)}
                  >
                    {minute.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
            <div className="flex flex-col justify-center p-2 gap-1">
              {["AM", "PM"].map((ampm) => (
                <Button
                  key={ampm}
                  size="sm"
                  variant={
                    date && ((ampm === "AM" && date.getHours() < 12) || (ampm === "PM" && date.getHours() >= 12))
                      ? "default"
                      : "ghost"
                  }
                  onClick={() => setAmPm(ampm)}
                >
                  {ampm}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
