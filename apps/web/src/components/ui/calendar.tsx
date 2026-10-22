"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

type CalendarMode = "single" | "range" | "multiple"

interface CalendarProps {
  mode?: CalendarMode
  selected?: Date | Date[] | Date | undefined
  onSelect?: (date: Date | Date[] | undefined) => void
  initialFocus?: Date
  disabled?: (date: Date) => boolean
  className?: string
  fromDate?: Date
  toDate?: Date
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  initialFocus,
  disabled,
  className,
  fromDate,
  toDate,
}: CalendarProps) {
  const [focusDate, setFocusDate] = React.useState(initialFocus || new Date())
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([])
  
  // Use controlled value when provided, otherwise use internal state
  const effectiveSelected = selected ? (Array.isArray(selected) ? selected : [selected]) : selectedDates

  const isSelected = (date: Date) => {
    return effectiveSelected.some(d => isSameDay(d, date))
  }

  const isInRange = (date: Date) => {
    if (effectiveSelected.length !== 2) return false
    const [start, end] = effectiveSelected.sort((a, b) => a.getTime() - b.getTime())
    return date >= start && date <= end
  }

  const isDisabled = (date: Date) => {
    if (disabled && disabled(date)) return true
    if (fromDate && date < startOfDay(fromDate)) return true
    if (toDate && date > endOfDay(toDate)) return true
    return false
  }

  const handleDayClick = (date: Date) => {
    if (isDisabled(date)) return

    let newDates: Date[] = []
    if (mode === "single") {
      newDates = [date]
    } else if (mode === "range") {
      if (effectiveSelected.length === 0 || effectiveSelected.length === 2) {
        newDates = [date]
      } else {
        newDates = [...effectiveSelected, date].sort((a, b) => a.getTime() - b.getTime())
      }
    } else if (mode === "multiple") {
      const index = effectiveSelected.findIndex(d => isSameDay(d, date))
      if (index >= 0) {
        newDates = effectiveSelected.filter((_, i) => i !== index)
      } else {
        newDates = [...effectiveSelected, date]
      }
    }

    if (!selected) {
      setSelectedDates(newDates)
    }
    onSelect?.(mode === "single" ? newDates[0] : newDates)
  }

  const month = focusDate.getMonth()
  const year = focusDate.getFullYear()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const today = new Date()

  const prevMonth = () => setFocusDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setFocusDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    const date = new Date(year, month, i - firstDayOfMonth + 1)
    days.push({ date, isCurrentMonth: false })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i)
    days.push({ date, isCurrentMonth: true })
  }

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold">
          {focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0 text-center text-sm font-medium text-muted-foreground mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0">
        {days.map(({ date, isCurrentMonth }, index) => (
          <Button
            key={index}
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 p-0 text-sm rounded-none",
              !isCurrentMonth && "text-muted-foreground/50",
              isDisabled(date) && "opacity-50 cursor-not-allowed",
              isSelected(date) && "bg-primary text-primary-foreground",
              isInRange(date) && "bg-primary/10",
              isSameDay(date, today) && "font-bold text-primary",
            )}
            onClick={() => handleDayClick(date)}
            disabled={isDisabled(date)}
          >
            {date.getDate()}
          </Button>
        ))}
      </div>
    </div>
  )
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}