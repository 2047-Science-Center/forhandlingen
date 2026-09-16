/** Visuell representation av resurserna (ikon = emoji i bärnstensram). */
export const RESOURCE_ICONS: Record<string, string> = {
  insulin: '💉',
  branslecell: '🔋',
  styrkort: '🎛️',
  radiosandare: '📡',
  membranfilter: '🚰',
}

export function resourceIcon(id: string): string {
  return RESOURCE_ICONS[id] ?? '❔'
}
