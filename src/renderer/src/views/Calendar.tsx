import { useEffect, useMemo, useState } from 'react'
import {
  RiCalendarLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiAlarmLine,
  RiCalendarCheckLine,
  RiLayoutGridLine,
  RiCalendar2Line
} from 'react-icons/ri'
import { getCalendarEvents, CalendarData } from '@renderer/services/system-info'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

type DayCell = {
  date: number
  isCurrentMonth: boolean
  isToday: boolean
  fullDate: Date
}

// Builds a real 6x7 month grid (with the correct leading/trailing days from
// neighbouring months) for any given year/month — no hardcoded dates.
const buildMonthGrid = (year: number, month: number, today: Date): DayCell[] => {
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: DayCell[] = []

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const fullDate = new Date(year, month - 1, d)
    cells.push({ date: d, isCurrentMonth: false, isToday: false, fullDate })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = new Date(year, month, d)
    const isToday =
      fullDate.getFullYear() === today.getFullYear() &&
      fullDate.getMonth() === today.getMonth() &&
      fullDate.getDate() === today.getDate()
    cells.push({ date: d, isCurrentMonth: true, isToday, fullDate })
  }

  let nextDay = 1
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const fullDate = new Date(year, month + 1, nextDay)
    cells.push({ date: nextDay, isCurrentMonth: false, isToday: false, fullDate })
    nextDay++
    if (cells.length >= 42) break
  }

  return cells
}

const MiniMonth = ({
  year,
  month,
  today,
  onOpen
}: {
  year: number
  month: number
  today: Date
  onOpen: () => void
}) => {
  const grid = useMemo(() => buildMonthGrid(year, month, today), [year, month, today])
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  return (
    <button onClick={onOpen} className="cal-mini-panel p-4 text-left cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold ${isCurrentMonth ? 'text-[var(--green-bright)]' : 'text-[var(--ink)]'}`}>
          {MONTHS[month]}
        </span>
        <span className="text-[9px] text-[var(--ink-faint)] font-data">{year}</span>
      </div>
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[7px] text-center text-[var(--ink-faint)] font-data">
            {w[0]}
          </span>
        ))}
        {grid.map((cell, i) => (
          <span
            key={i}
            className="text-[8px] text-center font-data rounded-sm"
            style={{
              color: !cell.isCurrentMonth ? 'var(--ink-faint)' : cell.isToday ? '#06140E' : 'var(--ink-dim)',
              background: cell.isToday ? 'var(--green)' : 'transparent',
              opacity: !cell.isCurrentMonth ? 0.35 : 1,
              padding: '2px 0'
            }}
          >
            {cell.date}
          </span>
        ))}
      </div>
    </button>
  )
}

const CalendarView = () => {
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const [now, setNow] = useState(new Date())

  const [calendar, setCalendar] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Keep a live clock so "today" stays accurate if the app is left open
  // across midnight.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getCalendarEvents()
        if (data) {
          setCalendar(data)
        } else {
          setError('Unable to load calendar events.')
        }
      } catch (err) {
        setError('Unable to load calendar events.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth, now), [viewYear, viewMonth, now])

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }
  const goToday = () => {
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setMode('month')
  }

  const openMonth = (m: number) => {
    setViewMonth(m)
    setMode('month')
  }

  return (
    <div className="cal-root flex-1 h-full overflow-auto p-6 md:p-8">
      <style>{`
        .cal-root {
          --bg-base: #060A08;
          --bg-sunken: #030504;
          --panel: #0C120E;
          --panel-raised: #101A14;
          --line: #1D2B22;
          --line-soft: #141F19;
          --ink: #EAF7EF;
          --ink-dim: #8FA398;
          --ink-faint: #4C5C52;
          --green: #00E38C;
          --green-bright: #4DFFC7;
          --green-soft: #00E38C1F;
          --danger: #FF6B6B;
          font-family: 'Manrope', -apple-system, sans-serif;
          background: var(--bg-base);
          color: var(--ink);
        }
        .cal-root .font-data { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        .cal-panel {
          background: linear-gradient(180deg, var(--panel-raised) 0%, var(--panel) 100%);
          border: 1px solid var(--line);
          border-radius: 20px;
          box-shadow: 0 1px 0 0 rgba(255,255,255,0.03) inset, 0 16px 32px -16px rgba(0,0,0,0.6);
        }
        .cal-well {
          background: var(--bg-sunken);
          border: 1px solid var(--line-soft);
          border-radius: 14px;
        }
        .cal-mini-panel {
          background: var(--bg-sunken);
          border: 1px solid var(--line-soft);
          border-radius: 14px;
          transition: all 0.15s ease;
        }
        .cal-mini-panel:hover { border-color: var(--green); background: var(--green-soft); }

        .cal-icon-btn {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink-dim);
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .cal-icon-btn:hover { border-color: var(--green); color: var(--green-bright); background: var(--green-soft); }

        .cal-mode-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink-dim);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cal-mode-pill.is-active {
          background: var(--green-soft);
          border-color: var(--green);
          color: var(--green-bright);
        }

        .cal-day-cell {
          aspect-ratio: 1;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          color: var(--ink-dim);
          border: 1px solid transparent;
          transition: all 0.15s ease;
        }
        .cal-day-cell.is-outside { color: var(--ink-faint); opacity: 0.4; }
        .cal-day-cell.is-today {
          background: var(--green);
          color: #06140E;
          font-weight: 800;
          box-shadow: 0 0 16px rgba(0,227,140,0.5);
        }
        .cal-day-cell:not(.is-today):hover {
          border-color: var(--line);
          background: var(--bg-sunken);
        }

        .cal-event-card {
          background: var(--bg-sunken);
          border: 1px solid var(--line-soft);
          border-radius: 16px;
        }
      `}</style>

      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="cal-panel w-12 h-12 flex items-center justify-center shrink-0">
              <RiCalendarLine size={20} className="text-[var(--green-bright)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--ink)]">Calendar</h1>
              <p className="text-xs text-[var(--ink-faint)] font-data mt-0.5">
                {now.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setMode('month')} className={`cal-mode-pill ${mode === 'month' ? 'is-active' : ''}`}>
              <RiCalendar2Line size={13} /> Month
            </button>
            <button onClick={() => setMode('year')} className={`cal-mode-pill ${mode === 'year' ? 'is-active' : ''}`}>
              <RiLayoutGridLine size={13} /> Year (12 months)
            </button>
            <button onClick={goToday} className="cal-mode-pill">
              Today
            </button>
          </div>
        </div>

        {mode === 'month' ? (
          <div className="cal-panel p-6 md:p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={goPrevMonth} className="cal-icon-btn">
                  <RiArrowLeftSLine size={18} />
                </button>
                <h2 className="text-lg font-bold text-[var(--ink)] w-48 text-center font-data">
                  {MONTHS[viewMonth]} {viewYear}
                </h2>
                <button onClick={goNextMonth} className="cal-icon-btn">
                  <RiArrowRightSLine size={18} />
                </button>
              </div>
              <span className="text-[10px] text-[var(--ink-faint)] font-data uppercase tracking-widest">
                {calendar?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[10px] font-bold text-[var(--ink-faint)] tracking-widest py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {grid.map((cell, i) => (
                <div
                  key={i}
                  className={`cal-day-cell ${!cell.isCurrentMonth ? 'is-outside' : ''} ${cell.isToday ? 'is-today' : ''}`}
                >
                  {cell.date}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="cal-panel p-6 md:p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewYear((y) => y - 1)} className="cal-icon-btn">
                  <RiArrowLeftSLine size={18} />
                </button>
                <h2 className="text-lg font-bold text-[var(--ink)] w-24 text-center font-data">{viewYear}</h2>
                <button onClick={() => setViewYear((y) => y + 1)} className="cal-icon-btn">
                  <RiArrowRightSLine size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {MONTHS.map((_, m) => (
                <MiniMonth key={m} year={viewYear} month={m} today={now} onOpen={() => openMonth(m)} />
              ))}
            </div>
          </div>
        )}

        {/* System scheduled tasks / reminders — untouched real data source */}
        <div className="cal-well p-6">
          <p className="text-xs text-[var(--ink-dim)] leading-relaxed">
            The schedule below reflects real local system scheduled tasks and reminders. Open a
            task to inspect its next run time.
          </p>
        </div>

        {loading ? (
          <div className="cal-well p-6 text-[var(--ink-faint)] text-sm">Loading calendar events…</div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-[var(--danger)]/25 bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
            {error}
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--ink-faint)]">
              <RiAlarmLine size={12} /> Local schedule
            </div>

            {calendar?.events.length ? (
              calendar.events.map((event) => (
                <div key={`${event.name}-${event.nextRun}`} className="cal-event-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--ink)]">{event.name}</div>
                      <div className="text-xs text-[var(--ink-faint)]">
                        {event.path || event.author || event.state}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--green-bright)]">
                      <RiCalendarCheckLine size={12} /> {event.state}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs text-[var(--ink-dim)]">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.3em] text-[var(--ink-faint)]">Last run</div>
                      <div className="font-data">{event.lastRun ?? 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.3em] text-[var(--ink-faint)]">Next run</div>
                      <div className="font-data">{event.nextRun ?? 'N/A'}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[9px] uppercase tracking-[0.3em] text-[var(--ink-faint)]">Result</div>
                  <div className="text-xs text-[var(--ink-dim)]">{event.result}</div>
                </div>
              ))
            ) : (
              <div className="cal-well p-5 text-[var(--ink-faint)] text-sm">
                No scheduled system tasks or reminders found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CalendarView