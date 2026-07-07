import type { CSSProperties } from 'react'

export function btn(bg: string, fg: string, extra?: CSSProperties): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '11px 8px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 13.5,
    background: bg,
    color: fg,
    ...extra,
  }
}

export const BTN_EDIT = btn('#5A4E3C', '#EFE7CF')
export const BTN_PENALTY = btn('#5A4E3C', '#EFE7CF')
export const BTN_REDEEM = btn('#7FB25C', '#22331A')
export const BTN_RESET = btn('#5A4E3C', '#EFE7CF')
export const BTN_GO = btn('#7FB25C', '#22331A', { flex: '0 0 auto' })
export const BTN_GHOST = btn('#5A4E3C', '#D8CDB4', { flex: '0 0 auto' })
export const BTN_DANGER = btn('#C4664A', '#FBEFE9', { flex: 1 })
export const BTN_CONFIRM = btn('#7FB25C', '#22331A', { flex: '0 0 auto' })
export const BTN_MINI = btn('#5A4E3C', '#D8CDB4', { padding: '6px 10px', fontSize: 12 })
export const BTN_SAVE = btn('#47702F', '#F6F1E2', { flex: 1 })
export const BTN_CANCEL = btn('#EFE7D4', '#7C6E52', { flex: '0 0 auto', paddingLeft: 16, paddingRight: 16 })

export const ICON_BTN: CSSProperties = {
  flex: '0 0 auto',
  width: 38,
  height: 38,
  borderRadius: 10,
  border: '1px solid #EADFCB',
  background: '#FBF7EC',
  fontSize: 17,
  cursor: 'pointer',
}

export const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 11,
  border: '1px solid #E0D6C2',
  fontSize: 15,
  fontWeight: 700,
  background: '#fff',
}

export const NUMBER_INPUT_STYLE: CSSProperties = {
  width: 84,
  padding: '9px 11px',
  borderRadius: 10,
  border: '1px solid #E0D6C2',
  fontSize: 15,
  fontWeight: 800,
}

export const PANEL_INPUT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  fontSize: 16,
  fontWeight: 800,
  color: '#3A3228',
}
