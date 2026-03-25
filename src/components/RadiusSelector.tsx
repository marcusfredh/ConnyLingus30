import { useSearchRadius } from '../context/useSearchRadius'

interface RadiusSelectorProps {
  onChange?: (radiusKm: number) => void
  className?: string
}

export function RadiusSelector({ onChange, className = '' }: RadiusSelectorProps) {
  const { radiusKm, setRadiusKm, minKm, maxKm } = useSearchRadius()

  const handleChange = (value: number) => {
    setRadiusKm(value)
    onChange?.(value)
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label htmlFor="radius-selector" className="text-xs text-gray-400 whitespace-nowrap">
        Sökradie:
      </label>
      <input
        id="radius-selector"
        type="range"
        min={minKm}
        max={maxKm}
        step={0.5}
        value={radiusKm}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
      <span className="text-sm font-medium text-amber-400 min-w-[3.5rem] text-right">
        {radiusKm} km
      </span>
    </div>
  )
}
