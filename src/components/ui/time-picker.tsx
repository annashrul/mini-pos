"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const hour = value?.split(":")[0] || "08"
  const minute = value?.split(":")[1] || "00"

  const hourListRef = useRef<HTMLDivElement>(null)
  const minuteListRef = useRef<HTMLDivElement>(null)

  const scrollToSelected = useCallback(() => {
    const scrollTo = (container: HTMLDivElement | null, val: string) => {
      if (!container) return
      const el = container.querySelector(`[data-value="${val}"]`) as HTMLElement | null
      if (!el) return
      const viewport = container.closest("[data-slot='scroll-area-viewport']") as HTMLElement | null
      if (viewport) {
        viewport.scrollTop = el.offsetTop - 40
      }
    }
    scrollTo(hourListRef.current, hour)
    scrollTo(minuteListRef.current, minute)
  }, [hour, minute])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => scrollToSelected())
    }
  }, [open, scrollToSelected])

  const select = (h: string, m: string) => {
    onChange(`${h}:${m}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start rounded-xl font-normal font-mono tabular-nums",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          {value || "-- : --"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[180px] rounded-xl p-0 overflow-hidden shadow-lg"
        align="start"
        sideOffset={4}
      >
        {/* Column headers */}
        <div className="flex divide-x divide-border border-b bg-muted/50">
          <div className="flex-1 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Jam
          </div>
          <div className="flex-1 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Menit
          </div>
        </div>
        {/* Columns */}
        <div className="flex h-[200px] divide-x divide-border">
          {/* Hours */}
          <ScrollArea className="flex-1">
            <div ref={hourListRef}>
              {HOURS.map((h) => {
                const isActive = hour === h
                return (
                  <button
                    key={h}
                    type="button"
                    data-value={h}
                    onClick={() => select(h, minute)}
                    className={cn(
                      "w-full py-2 text-center text-sm font-mono tabular-nums transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {h}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
          {/* Minutes */}
          <ScrollArea className="flex-1">
            <div ref={minuteListRef}>
              {MINUTES.map((m) => {
                const isActive = minute === m
                return (
                  <button
                    key={m}
                    type="button"
                    data-value={m}
                    onClick={() => select(hour, m)}
                    className={cn(
                      "w-full py-2 text-center text-sm font-mono tabular-nums transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>
        {/* Footer */}
        <div className="border-t p-2 bg-muted/30">
          <Button
            type="button"
            size="sm"
            className="w-full rounded-lg"
            onClick={() => setOpen(false)}
          >
            Selesai
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { TimePicker }
