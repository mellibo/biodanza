// Convierte el valor crudo de la columna "Lineas" de un catálogo Excel
// (ver CLAUDE.md) al nuevo esquema de etiquetas libres, para que una
// colección recién importada no arranque sin ninguna etiqueta si el
// catálogo ya traía esa info con la convención vieja. Solo se usa al
// importar (acción explícita del usuario, revisable en la previsualización
// antes de confirmar) -- no se aplica a datos ya guardados.
const LETRA_A_ETIQUETA: Record<string, string> = {
  V: 'Vitalidad',
  A: 'Afectividad',
  C: 'Creatividad',
  S: 'Sexualidad',
  T: 'Trascendencia',
}

export function parseLineasToEtiquetas(lineas: string | undefined | null): string[] {
  if (!lineas) return []
  const trimmed = lineas.trim()
  if (!trimmed) return []
  // Convención clásica: letras V/A/C/S/T concatenadas sin separador (ej "VACST")
  if (/^[VACSTvacst]+$/.test(trimmed)) {
    const letras = [...new Set(trimmed.toUpperCase().split(''))]
    return letras.map((l) => LETRA_A_ETIQUETA[l] ?? l)
  }
  // Si no, tratarlo como una lista separada por coma/punto y coma/slash
  return trimmed
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
