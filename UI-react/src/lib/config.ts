// Puerto de loaderService.config() (loaderService.js:57-66) -- por ahora
// solo lectura, ya que la UI para editar pathMusica está comentada incluso
// en el original (UI/biosoft.html:232-236).
interface BiodanzaConfig {
  pathMusica: string
}

export function getPathMusica(): string {
  const raw = window.localStorage.getItem('ngStorage-biodanzaConfig')
  if (raw) {
    try {
      const cfg = JSON.parse(raw) as BiodanzaConfig
      if (cfg?.pathMusica) return cfg.pathMusica
    } catch {
      // ignore, cae al default
    }
  }
  return 'musica/'
}
