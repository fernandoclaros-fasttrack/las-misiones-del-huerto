interface Props {
  options: string[]
  selected: string
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ options, selected, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map((emoji) => {
        const active = emoji === selected
        return (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              border: active ? '2px solid #5B8C3E' : '1px solid #E4DBC8',
              background: active ? '#DDEBC9' : '#FFFDF6',
              fontSize: 21,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: active ? 1 : 0.85,
            }}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}
