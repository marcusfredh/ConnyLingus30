import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ScheduleEvent {
  id: number
  title: string
  subtitle?: string
  description?: string
  link?: { label: string; to: string }
  startHour: number   // 0–23
  startMinute: number // 0–59
  endHour: number
  endMinute: number
  color: 'indigo' | 'amber' | 'green' | 'rose' | 'purple'
}

interface Day {
  label: string
  date: string
  events: ScheduleEvent[]
}

const DAYS: Day[] = [
  {
    label: 'Lördag',
    date: '28 mars',
    events: [
      {
        id: 1,
        title: 'Ankomst & incheckning',
        subtitle: 'Gothia Towers',
        description: 'Välkommen till Gothia Towers! Checka in i receptionen och gör dig hemmastadd i ditt Sky View-rum med utsikt över Göteborg.',
        link: { label: 'Gothia Towers', to: 'https://www.gothiatowers.com' },
        startHour: 15,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        color: 'indigo',
      },
      {
        id: 2,
        title: 'Ölprovning',
        subtitle: 'Spike Brewery',
        description: 'Guidad provning av fem hantverksbryggda öl från Spike Brewery. Poängsätt varje öl och se vad de andra tycker!',
        link: { label: 'Recensera ölarna', to: '/beers' },
        startHour: 12,
        startMinute: 0,
        endHour: 13,
        endMinute: 0,
        color: 'amber',
      },
      {
        id: 3,
        title: 'Lunch',
        description: 'Gemensam lunch. Meny presenteras på plats.',
        startHour: 13,
        startMinute: 0,
        endHour: 14,
        endMinute: 0,
        color: 'green',
      },
      {
        id: 7,
        title: 'Middag',
        subtitle: 'Levantine',
        description: 'Vi avslutar kvällen med middag på Levantine — en fransk bistro i hjärtat av Vasastan i Göteborg. Restaurangen är känd för sin avslappnade stämning, vällagad mat och ett välsorterat dryckesutbud.',
        link: { label: 'Se menyn', to: 'https://levantine.se/meny' },
        startHour: 19,
        startMinute: 0,
        endHour: 21,
        endMinute: 0,
        color: 'green',
      },
      {
        id: 4,
        title: 'Fest & kalas',
        description: 'Musik, dans och tårta. Connys 30-årskalas börjar på allvar!',
        startHour: 21,
        startMinute: 0,
        endHour: 23,
        endMinute: 59,
        color: 'purple',
      },
    ],
  },
  {
    label: 'Söndag',
    date: '29 mars',
    events: [
      {
        id: 5,
        title: 'Frukost',
        subtitle: 'Gothia Towers, våning 29',
        description: 'Frukost på våning 29 i Gothia Towers med utsikt över Göteborg — en av förmånerna med Sky View-rummen. Passa på att njuta av vyn innan utcheckning.',
        link: { label: 'Gothia Towers', to: 'https://www.gothiatowers.com' },
        startHour: 9,
        startMinute: 0,
        endHour: 10,
        endMinute: 30,
        color: 'amber',
      },
      {
        id: 6,
        title: 'Utcheckning',
        subtitle: 'Gothia Towers',
        description: 'Senast kl 12:00. Lämna rummet och checka ut i receptionen. Tack för att ni var med och firade Conny!',
        link: { label: 'Gothia Towers', to: 'https://www.gothiatowers.com' },
        startHour: 11,
        startMinute: 0,
        endHour: 12,
        endMinute: 0,
        color: 'indigo',
      },
    ],
  },
]

// Earliest and latest hours to render across both days
const START_HOUR = 8
const END_HOUR = 24
const HOUR_HEIGHT = 64 // px per hour

const COLOR_CLASSES: Record<
  ScheduleEvent['color'],
  { bg: string; border: string; title: string; sub: string; chip: string; chipText: string }
> = {
  indigo: { bg: 'bg-indigo-950/60', border: 'border-indigo-400', title: 'text-indigo-200', sub: 'text-indigo-400', chip: 'bg-indigo-900/60', chipText: 'text-indigo-300' },
  amber:  { bg: 'bg-amber-950/60',  border: 'border-amber-400',  title: 'text-amber-200',  sub: 'text-amber-400',  chip: 'bg-amber-900/60',  chipText: 'text-amber-300'  },
  green:  { bg: 'bg-green-950/60',  border: 'border-green-400',  title: 'text-green-200',  sub: 'text-green-400',  chip: 'bg-green-900/60',  chipText: 'text-green-300'  },
  rose:   { bg: 'bg-rose-950/60',   border: 'border-rose-400',   title: 'text-rose-200',   sub: 'text-rose-400',   chip: 'bg-rose-900/60',   chipText: 'text-rose-300'   },
  purple: { bg: 'bg-purple-950/60', border: 'border-purple-400', title: 'text-purple-200', sub: 'text-purple-400', chip: 'bg-purple-900/60', chipText: 'text-purple-300' },
}

function toMinutes(hour: number, minute: number) {
  return hour * 60 + minute
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// ─── Event block ────────────────────────────────────────────────────────────

function EventBlock({
  event,
  onPress,
}: {
  event: ScheduleEvent
  onPress: (event: ScheduleEvent) => void
}) {
  const colors = COLOR_CLASSES[event.color]

  const topOffset =
    ((toMinutes(event.startHour, event.startMinute) - toMinutes(START_HOUR, 0)) / 60) * HOUR_HEIGHT

  const durationMinutes =
    toMinutes(event.endHour, event.endMinute) - toMinutes(event.startHour, event.startMinute)
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28)

  const isShort = height < 48

  return (
    <button
      onClick={() => onPress(event)}
      className={`absolute left-0 right-0 rounded-lg border-l-4 px-2 py-1 overflow-hidden text-left active:brightness-110 transition ${colors.bg} ${colors.border}`}
      style={{ top: topOffset, height }}
    >
      <p className={`text-xs font-semibold leading-tight truncate ${colors.title}`}>
        {event.title}
      </p>
      {!isShort && (
        <>
          {event.subtitle && (
            <p className={`text-xs leading-tight truncate ${colors.sub}`}>{event.subtitle}</p>
          )}
          <p className={`text-xs leading-tight mt-0.5 ${colors.sub}`}>
            {formatTime(event.startHour, event.startMinute)} – {formatTime(event.endHour, event.endMinute)}
          </p>
        </>
      )}
    </button>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function EventModal({
  event,
  onClose,
}: {
  event: ScheduleEvent
  onClose: () => void
}) {
  const navigate = useNavigate()
  const colors = COLOR_CLASSES[event.color]

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-0"
      onClick={onClose}
    >
      {/* Sheet — stop propagation so clicks inside don't close it */}
      <div
        className="w-full max-w-lg bg-gray-900 border-t border-gray-700 rounded-t-3xl px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto -mt-1 mb-1" />

        {/* Color chip + title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {event.subtitle && (
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${colors.chip} ${colors.chipText}`}>
                {event.subtitle}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-50 leading-tight">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 -mr-1 text-gray-500 active:text-gray-300"
            aria-label="Stäng"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Time row */}
        <div className={`flex items-center gap-2 text-sm font-medium ${colors.sub}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          {formatTime(event.startHour, event.startMinute)} – {formatTime(event.endHour, event.endMinute)}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700" />

        {/* Description */}
        {event.description && (
          <p className="text-sm text-gray-400 leading-relaxed">{event.description}</p>
        )}

        {/* CTA button */}
        {event.link && (
          event.link.to.startsWith('http') ? (
            <a
              href={event.link.to}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {event.link.label}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <button
              onClick={() => navigate(event.link!.to)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {event.link.label}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ─── Day column ──────────────────────────────────────────────────────────────

function DayColumn({
  day,
  onEventPress,
}: {
  day: Day
  onEventPress: (event: ScheduleEvent) => void
}) {
  const totalHours = END_HOUR - START_HOUR
  const totalHeight = totalHours * HOUR_HEIGHT

  return (
    <div className="flex-1 min-w-0">
      <div className="relative" style={{ height: totalHeight }}>
        {/* Hour grid lines */}
        {Array.from({ length: totalHours }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-gray-800"
            style={{ top: i * HOUR_HEIGHT }}
          />
        ))}

        {/* Events */}
        <div className="absolute inset-0 px-1">
          {day.events.map((event) => (
            <EventBlock key={event.id} event={event} onPress={onEventPress} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const navigate = useNavigate()
  const [activeDay, setActiveDay] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null)

  const day = DAYS[activeDay]
  const totalHours = END_HOUR - START_HOUR

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 bg-gray-900 border-b border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="text-indigo-400 active:text-indigo-300 p-1 -ml-1"
          aria-label="Tillbaka"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-50">Schema</h1>
          <p className="text-xs text-gray-400">Connys 30-årskalas</p>
        </div>
      </header>

      {/* Day tabs */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 flex gap-2 pt-2">
        {DAYS.map((d, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className={`flex-1 pb-2 text-sm font-semibold border-b-2 transition ${
              activeDay === i
                ? 'border-indigo-400 text-indigo-400'
                : 'border-transparent text-gray-500 active:text-gray-300'
            }`}
          >
            <span className="block">{d.label}</span>
            <span className="block text-xs font-normal">{d.date}</span>
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <main className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-14 shrink-0 relative" style={{ height: totalHours * HOUR_HEIGHT }}>
            {Array.from({ length: totalHours }, (_, i) => {
              const hour = START_HOUR + i
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-start justify-end pr-2"
                  style={{ top: i * HOUR_HEIGHT - 8 }}
                >
                  <span className="text-[10px] text-gray-600 leading-none">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              )
            })}
          </div>

          {/* Day column */}
          <DayColumn day={day} onEventPress={setSelectedEvent} />
        </div>
      </main>

      {/* Event modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

    </div>
  )
}
