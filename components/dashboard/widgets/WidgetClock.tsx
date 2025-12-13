"use client";

import { useEffect, useState } from "react";
import WidgetTile from "./WidgetTile";

export default function WidgetClock() {
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHour = ((hours + 11) % 12) + 1;

  return (
    <WidgetTile
      size="small"
      gradient="from-slate-900 via-slate-800 to-slate-900"
      borderColor="border-slate-700/60"
      className="text-white"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/60 font-semibold">
          Current Time
        </p>
      </div>
      <div className="text-5xl font-black">
        {formattedHour}:{minutes}
        <span className="text-2xl font-semibold ml-2">{ampm}</span>
      </div>
      <p className="text-sm font-semibold text-white/60">
        {date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
    </WidgetTile>
  );
}




