/** Right-aligned game count in a sidebar row ("12", read as "12 games"). */
export function Count({ value }: { value: number }) {
  return (
    <span className="sidebar-count">
      {value}
      <span className="visually-hidden">{value === 1 ? ' game' : ' games'}</span>
    </span>
  )
}
