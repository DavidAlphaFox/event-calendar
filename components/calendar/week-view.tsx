"use client"

import type React from "react"

import { useMemo } from "react"
import {
  addHours,
  eachDayOfInterval,
  eachHourOfInterval,
  endOfWeek,
  format,
  getHours,
  getMinutes,
  isSameDay,
  isToday,
  startOfDay,
  startOfWeek,
  differenceInMinutes,
  areIntervalsOverlapping,
  differenceInDays,
  isBefore,
} from "date-fns"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@/components/calendar/types"
import { DraggableEvent } from "@/components/calendar/draggable-event"
import { DroppableCell } from "@/components/calendar/droppable-cell"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventSelect: (event: CalendarEvent) => void
  onEventCreate: (startTime: Date) => void
}

interface PositionedEvent {
  event: CalendarEvent
  top: number
  height: number
  left: number
  width: number
  zIndex: number
}

export function WeekView({ currentDate, events, onEventSelect, onEventCreate }: WeekViewProps) {
  const hourHeight = 56 // height of hour cell in pixels

  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: weekStart, end: weekEnd })
  }, [currentDate])

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate])

  const hours = useMemo(() => {
    const dayStart = startOfDay(currentDate)
    return eachHourOfInterval({
      start: dayStart,
      end: addHours(dayStart, 23),
    })
  }, [currentDate])

  // Get all-day events and multi-day events
  const allDayEvents = useMemo(() => {
    return events
      .filter((event) => {
        // Include explicitly marked all-day events
        if (event.allDay) return true

        // Include events that span multiple days
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)
        return differenceInDays(eventEnd, eventStart) >= 1
      })
      .filter((event) => {
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)
        return days.some(
          (day) => isSameDay(day, eventStart) || isSameDay(day, eventEnd) || (day > eventStart && day < eventEnd),
        )
      })
  }, [events, days])

  // Process events for each day to calculate positions
  const processedDayEvents = useMemo(() => {
    const result = days.map((day) => {
      // Get events for this day that are not all-day events or multi-day events
      const dayEvents = events.filter((event) => {
        // Skip all-day events
        if (event.allDay) return false

        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)

        // Skip events that span multiple days
        if (differenceInDays(eventEnd, eventStart) >= 1) return false

        // Check if event is on this day
        return isSameDay(day, eventStart) || isSameDay(day, eventEnd) || (eventStart < day && eventEnd > day)
      })

      // Sort events by start time and duration
      const sortedEvents = [...dayEvents].sort((a, b) => {
        const aStart = new Date(a.start)
        const bStart = new Date(b.start)
        const aEnd = new Date(a.end)
        const bEnd = new Date(b.end)

        // First sort by start time
        if (aStart < bStart) return -1
        if (aStart > bStart) return 1

        // If start times are equal, sort by duration (longer events first)
        const aDuration = differenceInMinutes(aEnd, aStart)
        const bDuration = differenceInMinutes(bEnd, bStart)
        return bDuration - aDuration
      })

      // Calculate positions for each event
      const positionedEvents: PositionedEvent[] = []
      const dayStart = startOfDay(day)

      // Track columns for overlapping events
      const columns: { event: CalendarEvent; end: Date }[][] = []

      sortedEvents.forEach((event) => {
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)

        // Adjust start and end times if they're outside this day
        const adjustedStart = isSameDay(day, eventStart) ? eventStart : dayStart
        const adjustedEnd = isSameDay(day, eventEnd) ? eventEnd : addHours(dayStart, 24)

        // Calculate top position and height
        const startHour = getHours(adjustedStart) + getMinutes(adjustedStart) / 60
        const endHour = getHours(adjustedEnd) + getMinutes(adjustedEnd) / 60
        const top = startHour * hourHeight
        const height = (endHour - startHour) * hourHeight

        // Find a column for this event
        let columnIndex = 0
        let placed = false

        while (!placed) {
          if (!columns[columnIndex]) {
            columns[columnIndex] = []
            placed = true
          } else {
            // Check if this event overlaps with any event in this column
            const overlaps = columns[columnIndex].some((col) =>
              areIntervalsOverlapping(
                { start: adjustedStart, end: adjustedEnd },
                { start: new Date(col.event.start), end: new Date(col.event.end) },
              ),
            )

            if (!overlaps) {
              placed = true
            } else {
              columnIndex++
            }
          }
        }

        // Add event to its column
        columns[columnIndex].push({ event, end: adjustedEnd })

        // Calculate width and left position based on number of columns
        const totalColumns = columns.length
        // First column takes full width, others are indented by 10% and take 90% width
        const width = columnIndex === 0 ? 1 : 0.9
        const left = columnIndex === 0 ? 0 : columnIndex * 0.1

        positionedEvents.push({
          event,
          top,
          height,
          left,
          width,
          zIndex: 10 + columnIndex, // Higher columns get higher z-index
        })
      })

      return positionedEvents
    })

    return result
  }, [days, events, hourHeight])

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    onEventSelect(event)
  }

  // Determine if we need to show the all-day section
  const showAllDaySection = allDayEvents.length > 0

  const getEventColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-100/50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-500"
      case "green":
        return "bg-green-100/50 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-500"
      case "red":
        return "bg-red-100/50 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-500"
      case "yellow":
        return "bg-yellow-100/50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-500"
      case "purple":
        return "bg-purple-100/50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-500"
      case "pink":
        return "bg-pink-100/50 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-500"
      case "orange":
        return "bg-orange-100/50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-500"
      default:
        return "bg-blue-100/50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-500"
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {showAllDaySection && (
        <div className="border-b">
          <div className="grid grid-cols-8 border-b">
            <div className="py-1 pl-2 text-xs font-medium text-muted-foreground">All day</div>
            {days.map((day) => (
              <div
                key={day.toString()}
                className={cn("py-1 text-center text-xs font-medium", isToday(day) && "bg-blue-50 dark:bg-blue-950/20")}
              >
                {format(day, "EEE dd")}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-8 min-h-[40px]">
            <div className="border-r" />
            {days.map((day, dayIndex) => {
              const dayAllDayEvents = allDayEvents.filter((event) => {
                const eventStart = new Date(event.start)
                const eventEnd = new Date(event.end)
                return isSameDay(day, eventStart) || (day > eventStart && day < eventEnd) || isSameDay(day, eventEnd)
              })

              return (
                <div
                  key={day.toString()}
                  className={cn("p-1 border-r relative", isToday(day) && "bg-blue-50 dark:bg-blue-950/20")}
                >
                  {dayAllDayEvents.map((event) => {
                    const eventStart = new Date(event.start)
                    const eventEnd = new Date(event.end)
                    const isMultiDay = differenceInDays(eventEnd, eventStart) >= 1
                    const isFirstDay = isSameDay(day, eventStart)
                    const isLastDay = isSameDay(day, eventEnd)

                    // Check if this is the first day in the current week view
                    const isFirstVisibleDay = dayIndex === 0 && isBefore(eventStart, weekStart)
                    const shouldShowTitle = isFirstDay || isFirstVisibleDay

                    // Only make single-day all-day events draggable
                    if (!isMultiDay && isFirstDay) {
                      return (
                        <div key={event.id} onClick={(e) => e.stopPropagation()} className="mb-1">
                          <DraggableEvent
                            event={event}
                            view="week"
                            onClick={(e) => handleEventClick(event, e)}
                            isFirstDay={true}
                            isLastDay={true}
                          />
                        </div>
                      )
                    } else {
                      // Non-draggable version for multi-day events
                      return (
                        <div
                          key={`${event.id}-${day.toISOString()}`}
                          className={cn(
                            "px-2 py-1 text-xs cursor-pointer select-none mb-1",
                            getEventColorClasses(event.color || "blue"),
                            isFirstDay && isLastDay
                              ? "rounded-md"
                              : isFirstDay
                                ? "rounded-l-md rounded-r-none"
                                : isLastDay
                                  ? "rounded-r-md rounded-l-none"
                                  : "rounded-none",
                          )}
                          onClick={(e) => handleEventClick(event, e)}
                        >
                          {/* Show title if it's the first day of the event or the first visible day in the week */}
                          <div className={cn(!shouldShowTitle && "invisible")} aria-hidden={!shouldShowTitle}>
                            {event.title}
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-8 flex-1 relative">
        <div className="border-r border-border/70 relative">
          <div className="sticky top-0 z-10 bg-background border-b py-1 text-center text-xs font-medium">Time</div>
          {hours.map((hour) => (
            <div key={hour.toString()} className="h-14 border-b border-border/70 last:border-b-0 relative">
              <span className="absolute -top-3 left-2 text-xs text-muted-foreground">{format(hour, "h a")}</span>
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={day.toString()}
            className={cn("border-r border-border/70 last:border-r-0 relative", isToday(day) && "bg-blue-50 dark:bg-blue-950/20")}
          >
            <div className="sticky top-0 z-10 bg-background border-b border-border/70 py-1 text-center text-xs font-medium">
              {format(day, "EEE dd")}
            </div>

            {/* Time grid */}
            <div className="relative">
              {hours.map((hour) => {
                const hourValue = getHours(hour)
                return (
                  <div key={hour.toString()} className="h-14 border-b border-border/70 last:border-b-0 relative">
                    {/* Quarter-hour intervals */}
                    {[0, 1, 2, 3].map((quarter) => {
                      const quarterHourTime = hourValue + quarter * 0.25
                      return (
                        <DroppableCell
                          key={`${hour.toString()}-${quarter}`}
                          id={`week-cell-${day.toISOString()}-${quarterHourTime}`}
                          date={day}
                          time={quarterHourTime}
                          className={cn(
                            "absolute w-full",
                            quarter === 0 ? "h-3.5 top-0" : "h-3.5",
                            quarter === 1 && "top-3.5",
                            quarter === 2 && "top-7",
                            quarter === 3 && "top-[2.625rem]",
                          )}
                          onClick={() => {
                            const startTime = new Date(day)
                            startTime.setHours(hourValue)
                            startTime.setMinutes(quarter * 15)
                            onEventCreate(startTime)
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}

              {/* Positioned events */}
              {processedDayEvents[dayIndex].map((positionedEvent) => (
                <div
                  key={positionedEvent.event.id}
                  className="absolute z-10"
                  style={{
                    top: `${positionedEvent.top}px`,
                    height: `${positionedEvent.height}px`,
                    left: `${positionedEvent.left * 100}%`,
                    width: `${positionedEvent.width * 100}%`,
                    zIndex: positionedEvent.zIndex,
                    padding: "0 2px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="h-full w-full">
                    <DraggableEvent
                      event={positionedEvent.event}
                      view="week"
                      onClick={(e) => handleEventClick(positionedEvent.event, e)}
                      showTime
                      height={positionedEvent.height}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
