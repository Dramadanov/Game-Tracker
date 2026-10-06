import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { TAG_COLORS } from '../../domain/constants'
import { Popover } from '../ui'
import { opensUpward, useFocusReturn } from '../sidebar/popoverAssist'

const COLOR_NAMES: Record<string, string> = {
  '#e5484d': 'Red',
  '#f76b15': 'Orange',
  '#ffb224': 'Amber',
  '#46a758': 'Green',
  '#12a594': 'Teal',
  '#0090ff': 'Blue',
  '#3e63dd': 'Indigo',
  '#8e4ec6': 'Purple',
  '#d6409f': 'Pink',
  '#8b8d98': 'Gray',
}

/** Human name for a palette color ("Teal"), or the raw value for custom colors. */
export function colorName(color: string): string {
  return COLOR_NAMES[color.toLowerCase()] ?? color
}

const COLUMNS = 5
/** Approximate height of the color panel, used to decide whether it opens upwards. */
const PANEL_HEIGHT = 112

const swatchStyle = (color: string) => ({ '--swatch': color }) as CSSProperties

/** Round color swatch button that opens a grid of tag colors. */
export function ColorPicker({
  value,
  onChange,
  label,
  size = 'md',
}: {
  value: string
  onChange(color: string): void
  /** Accessible name, e.g. "Color for Co-op". */
  label: string
  size?: 'sm' | 'md'
}) {
  const [upward, setUpward] = useState(false)
  return (
    <Popover
      label={label}
      panelClassName={`tagmgr-colors${upward ? ' tagmgr-colors-up' : ''}`}
      trigger={({ open, toggle }) => (
        <SwatchTrigger
          open={open}
          color={value}
          label={label}
          size={size}
          onClick={(el) => {
            if (!open) setUpward(opensUpward(el, PANEL_HEIGHT))
            toggle()
          }}
        />
      )}
    >
      {(close) => (
        <ColorGrid
          value={value}
          onPick={(color) => {
            close()
            if (color !== value) onChange(color)
          }}
        />
      )}
    </Popover>
  )
}

function SwatchTrigger({
  open,
  color,
  label,
  size,
  onClick,
}: {
  open: boolean
  color: string
  label: string
  size: 'sm' | 'md'
  onClick(el: HTMLElement): void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useFocusReturn(open, ref)
  return (
    <button
      ref={ref}
      type="button"
      className={`tagmgr-swatch-btn tagmgr-swatch-btn-${size}`}
      style={swatchStyle(color)}
      aria-label={`${label}: ${colorName(color)}`}
      title={`Change color (${colorName(color)})`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => onClick(e.currentTarget)}
    >
      <span className="tagmgr-swatch" aria-hidden="true" />
    </button>
  )
}

/** 5-column swatch grid. Focuses the current color on open; arrow keys move between swatches. */
function ColorGrid({ value, onPick }: { value: string; onPick(color: string): void }) {
  const ref = useRef<HTMLDivElement>(null)
  // Swatch to focus when the grid opens: the current color, or the first one.
  const initialIndex = useRef(Math.max(0, TAG_COLORS.findIndex((c) => c.toLowerCase() === value.toLowerCase())))

  useEffect(() => {
    ref.current?.querySelectorAll<HTMLButtonElement>('button')[initialIndex.current]?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }
    const step = moves[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = index + step
    if (next >= 0 && next < buttons.length) buttons[next].focus()
  }

  return (
    <div className="tagmgr-colors-inner">
      <div className="menu-heading">Color</div>
      <div ref={ref} className="tagmgr-color-grid" role="group" aria-label="Tag colors" onKeyDown={onKeyDown}>
        {TAG_COLORS.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase()
          return (
            <button
              key={color}
              type="button"
              className={`tagmgr-color${selected ? ' is-selected' : ''}`}
              style={swatchStyle(color)}
              aria-label={colorName(color)}
              aria-pressed={selected}
              title={colorName(color)}
              onClick={() => onPick(color)}
            >
              {selected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
