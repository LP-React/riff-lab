export interface Settings { keys: string[]; volume: number; speed: number }
export const defaults: Settings = { keys: ['KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'], volume: 65, speed: 2 }
export function keyLabel(code: string) { return code.replace(/^Key|^Digit/, '').replace('Arrow', '↔ ') }
export function validKeys(keys: string[]) {
  return keys.length === 5 && new Set(keys).size === 5 && keys.every(key => /^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Numpad[0-9])$/.test(key))
}
export function readSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem('riff-settings') ?? 'null')
    if (data && validKeys(data.keys) && Number.isFinite(data.volume) && data.volume >= 0 && data.volume <= 200 && Number.isFinite(data.speed) && data.speed >= .5 && data.speed <= 4) return data
  } catch { /* Storage may be unavailable. */ }
  return { ...defaults, keys: [...defaults.keys] }
}
export function saveSettings(settings: Settings) { try { localStorage.setItem('riff-settings', JSON.stringify(settings)) } catch { /* Session settings still work. */ } }
