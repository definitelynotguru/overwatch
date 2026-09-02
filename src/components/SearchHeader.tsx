import { useEffect, useState } from 'react'

type Props = {
  query: string
  onSearch: (q: string) => void
  onClear: () => void
}

export function SearchHeader({ query, onSearch, onClear }: Props) {
  const [value, setValue] = useState(query)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setValue(query)
  }, [query])

  function submit() {
    onSearch(value.trim())
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        Overwatch
      </div>
      <form
        className="search-wrap"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={value}
          placeholder="airports near london"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setValue('')
              onClear()
            }
          }}
        />
        <button className="search-btn" type="submit" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </button>
      </form>
      <div className="header-actions">
        <button className={copied ? 'ghost copied' : 'ghost'} type="button" onClick={share}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" />
            <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.43a5 5 0 0 0 7.07 7.07L14 19" />
          </svg>
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
    </header>
  )
}
