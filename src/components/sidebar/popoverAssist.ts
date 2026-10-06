import { useEffect, useRef, type RefObject } from 'react'

/**
 * Small helpers for the shared Popover when it lives inside a scrolling pane
 * (the sidebar list, a dialog body). Used by the sidebar and the tag manager.
 */

function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') return node
    node = node.parentElement
  }
  return null
}

/**
 * True when a panel of roughly `panelHeight` px would not fit below `trigger` inside its
 * scrolling pane but has more room above — so it should open upwards instead of being clipped.
 */
export function opensUpward(trigger: HTMLElement, panelHeight: number): boolean {
  const pane = scrollParent(trigger)
  const bounds = pane ? pane.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
  const rect = trigger.getBoundingClientRect()
  const below = bounds.bottom - rect.bottom
  const above = rect.top - bounds.top
  return below < panelHeight + 8 && above > below
}

/**
 * When a popover closes while focus was inside its (now removed) panel, put focus back on
 * the trigger so keyboard users don't get dropped at the top of the page.
 */
export function useFocusReturn(open: boolean, triggerRef: RefObject<HTMLElement | null>): void {
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement
      const lost = !active || active === document.body || active instanceof HTMLDialogElement
      if (lost) triggerRef.current?.focus()
    }
    wasOpen.current = open
  }, [open, triggerRef])
}
