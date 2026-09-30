<#
.SYNOPSIS
  Exporta todas las playlists de Winamp de esta PC a una carpeta (y un .zip),
  listas para importar en Biosoft (Clases > Importar Playlists).

.DESCRIPTION
  Toma:
    - Las playlists de la Biblioteca (Media Library): Plugins\ml\playlists.xml
      + los archivos plf*.m3u8 / plf*.m3u que referencia (con su nombre real).
    - Opcional (-IncluirActual): la lista de reproduccion actual (winamp.m3u8).
    - Opcional (-CarpetasExtra): cualquier .m3u/.m3u8/.pls suelto en esas carpetas.
  Cada playlist se guarda como "<Nombre>.m3u8" en UTF-8 (con BOM), con rutas
  absolutas, la linea #PLAYLIST:<Nombre> y la linea #FECHA:<aaaa-mm-ddThh:mm:ss>
  (fecha de creacion del archivo de la playlist; si la de ultima modificacion
  es anterior -- pasa cuando la carpeta se copio de otra PC -- se usa esa).
  El archivo exportado conserva tambien esas fechas. Tambien genera indice.csv con la
  cantidad de temas y cuantos archivos no existen en disco.
  Con -CopiarMusica copia ademas los archivos de audio referenciados a
  <Destino>\musica\ (manteniendo la estructura de carpetas, sin la unidad).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\exportar-playlists-winamp.ps1

.EXAMPLE
  .\exportar-playlists-winamp.ps1 -Destino D:\ExportWinamp -IncluirActual -CopiarMusica
#>
param(
  [string]$Destino = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'PlaylistsWinamp'),
  [string]$CarpetaWinamp = '',
  [string[]]$CarpetasExtra = @(),
  [switch]$IncluirActual,
  [switch]$CopiarMusica,
  [switch]$SinZip
)

$ErrorActionPreference = 'Stop'
$utf8Bom = New-Object System.Text.UTF8Encoding $true

# Limpia lo que llega por parametro: comillas sobrantes y "\" final
# (ojo: -CarpetaWinamp "C:\Program Files\Winamp\" desde cmd deja una comilla
# pegada al final por el \" -- por eso se recorta).
function Limpiar-Ruta([string]$r) {
  if (-not $r) { return '' }
  $r = $r.Trim().Trim('"').Trim("'").Trim()
  $r = [Environment]::ExpandEnvironmentVariables($r)
  if ($r.Length -gt 3) { $r = $r.TrimEnd('\', '/') }
  $r
}

# Winamp puede guardar su configuracion (y la Biblioteca) fuera de la carpeta
# de instalacion, segun paths.ini ("inidir=" / "M3UDir="). {26} = %APPDATA%.
function Leer-PathsIni([string]$dirInstalacion) {
  $ini = Join-Path $dirInstalacion 'paths.ini'
  if (-not (Test-Path -LiteralPath $ini)) { return @() }
  $res = @()
  foreach ($l in (Get-Content -LiteralPath $ini)) {
    if ($l -match '^\s*(inidir|m3udir)\s*=\s*(.+)$') {
      $v = $matches[2].Trim().Replace('{26}', $env:APPDATA).Replace('{28}', $env:LOCALAPPDATA).Replace('{5}', [Environment]::GetFolderPath('MyDocuments'))
      if (-not [IO.Path]::IsPathRooted($v)) { $v = Join-Path $dirInstalacion $v }
      $res += $v
    }
  }
  $res
}

function Get-CarpetasWinamp {
  $c = @()
  $param = Limpiar-Ruta $CarpetaWinamp
  if ($param) { $c += $param }
  $c += (Join-Path $env:APPDATA 'Winamp')
  $c += (Join-Path $env:LOCALAPPDATA 'Winamp')
  foreach ($pf in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
    if ($pf) { $c += (Join-Path $pf 'Winamp') }
  }
  # Carpeta de instalacion registrada por el instalador de Winamp.
  foreach ($k in @('HKCU:\Software\Winamp', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Winamp', 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Winamp')) {
    try {
      $item = Get-ItemProperty -Path $k -ErrorAction Stop
      $v = $item.'(default)'
      if (-not $v) { $v = $item.InstallLocation }
      if (-not $v -and $item.UninstallString) { $v = Split-Path ($item.UninstallString.Trim('"')) -Parent }
      if ($v) { $c += (Limpiar-Ruta $v) }
    } catch {}
  }
  $extra = @()
  foreach ($d in $c) { if ($d -and (Test-Path -LiteralPath $d)) { $extra += Leer-PathsIni $d } }
  $c += $extra
  $vistas = @{}
  foreach ($d in $c) {
    if (-not $d) { continue }
    $k = $d.ToLower()
    if ($vistas.ContainsKey($k)) { continue }
    $vistas[$k] = $true
    $existe = Test-Path -LiteralPath $d
    Write-Host ("  {0} {1}" -f $(if ($existe) { '[ok]      ' } else { '[no existe]' }), $d)
    if ($existe) { $d }
  }
}

function Limpiar-Nombre([string]$nombre) {
  $inv = [IO.Path]::GetInvalidFileNameChars()
  $r = -join ($nombre.ToCharArray() | ForEach-Object { if ($inv -contains $_) { '_' } else { $_ } })
  $r = $r.Trim().TrimEnd('.')
  if (-not $r) { $r = 'playlist' }
  $r
}

# Lee una playlist y devuelve objetos @{ Ruta; Titulo; Segundos } con rutas absolutas.
function Leer-Playlist([string]$archivo) {
  $ext = [IO.Path]::GetExtension($archivo).ToLower()
  $bytes = [IO.File]::ReadAllBytes($archivo)
  $esUtf8 = ($ext -eq '.m3u8') -or ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  $enc = if ($esUtf8) { [Text.Encoding]::UTF8 } else { [Text.Encoding]::Default }
  $lineas = $enc.GetString($bytes).TrimStart([char]0xFEFF) -split "`r?`n"
  $base = Split-Path $archivo -Parent
  $items = New-Object System.Collections.Generic.List[object]

  function Absoluta([string]$r) {
    $r = $r.Trim()
    if ($r -match '^file:///?') { $r = [Uri]::UnescapeDataString(($r -replace '^file:///?', '')) -replace '/', '\' }
    if ($r -match '^[a-zA-Z]+://') { return $r }            # stream/URL: se deja igual
    if (-not [IO.Path]::IsPathRooted($r)) { $r = Join-Path $base $r }
    try { [IO.Path]::GetFullPath($r) } catch { $r }
  }

  if ($ext -eq '.pls') {
    $tmp = @{}
    foreach ($l in $lineas) {
      if ($l -match '^(File|Title|Length)(\d+)=(.*)$') {
        $n = [int]$matches[2]
        if (-not $tmp.ContainsKey($n)) { $tmp[$n] = @{ Ruta = ''; Titulo = ''; Segundos = -1 } }
        switch ($matches[1].ToLower()) {
          'file'   { $tmp[$n].Ruta = Absoluta $matches[3] }
          'title'  { $tmp[$n].Titulo = $matches[3] }
          'length' { $tmp[$n].Segundos = [int]$matches[3] }
        }
      }
    }
    foreach ($k in ($tmp.Keys | Sort-Object)) { if ($tmp[$k].Ruta) { $items.Add([pscustomobject]$tmp[$k]) } }
  } else {
    $pend = $null
    foreach ($l in $lineas) {
      $t = $l.Trim()
      if (-not $t) { continue }
      if ($t -match '^#EXTINF:\s*(-?\d+)[^,]*,(.*)$') { $pend = @{ Segundos = [int]$matches[1]; Titulo = $matches[2] }; continue }
      if ($t.StartsWith('#')) { continue }
      $items.Add([pscustomobject]@{
        Ruta = Absoluta $t
        Titulo = if ($pend) { $pend.Titulo } else { '' }
        Segundos = if ($pend) { $pend.Segundos } else { -1 }
      })
      $pend = $null
    }
  }
  ,$items
}

# --- Juntar playlists: lista de @{ Titulo; Archivo; Origen } ---
$playlists = New-Object System.Collections.Generic.List[object]
$yaAgregados = @{}
function Agregar-Playlist([string]$titulo, [string]$archivo, [string]$origen) {
  $k = $archivo.ToLower()
  if ($yaAgregados.ContainsKey($k)) { return }
  $yaAgregados[$k] = $true
  $playlists.Add([pscustomobject]@{ Titulo = $titulo; Archivo = $archivo; Origen = $origen })
}

Write-Host 'Carpetas revisadas:'
$carpetas = @(Get-CarpetasWinamp)
$paramLimpio = Limpiar-Ruta $CarpetaWinamp
Write-Host ''

foreach ($cw in $carpetas) {
  # playlists.xml puede estar en <carpeta>\Plugins\ml\ o directamente en la
  # carpeta indicada (si se paso la carpeta "ml" como parametro) -- se busca
  # en cualquier subcarpeta.
  $xmls = @(Get-ChildItem -LiteralPath $cw -Recurse -Filter 'playlists.xml' -File -ErrorAction SilentlyContinue)
  foreach ($x in $xmls) {
    $ml = $x.DirectoryName
    Write-Host "Biblioteca de Winamp: $($x.FullName)"
    $doc = New-Object System.Xml.XmlDocument
    try { $doc.Load($x.FullName) } catch { Write-Warning "No se pudo leer $($x.FullName): $_"; continue }
    $n = 0
    foreach ($p in $doc.SelectNodes('//playlist')) {
      $fn = $p.GetAttribute('filename')
      if (-not $fn) { continue }
      $ruta = if ([IO.Path]::IsPathRooted($fn)) { $fn } else { Join-Path $ml $fn }
      if (-not (Test-Path -LiteralPath $ruta)) {
        # Si el xml trae una ruta absoluta vieja, probar con el mismo nombre en la carpeta del xml.
        $alt = Join-Path $ml (Split-Path $fn -Leaf)
        if (Test-Path -LiteralPath $alt) { $ruta = $alt } else { Write-Warning "No existe el archivo de la playlist '$($p.GetAttribute('title'))': $ruta"; continue }
      }
      $titulo = $p.GetAttribute('title')
      if (-not $titulo) { $titulo = [IO.Path]::GetFileNameWithoutExtension($ruta) }
      Agregar-Playlist $titulo $ruta 'Biblioteca'
      $n++
    }
    Write-Host "  $n playlists en la biblioteca"
  }
  if ($IncluirActual) {
    foreach ($n in @('winamp.m3u8', 'Winamp.m3u')) {
      $a = Join-Path $cw $n
      if (Test-Path -LiteralPath $a) { Agregar-Playlist 'Winamp - lista actual' $a 'Actual'; break }
    }
  }
}

# Si la carpeta pasada por parametro no tiene Biblioteca, tomar los
# .m3u/.m3u8/.pls que haya adentro (ej. la carpeta Plugins\ml sin xml, o una
# carpeta donde se guardaron playlists a mano).
if ($paramLimpio -and (Test-Path -LiteralPath $paramLimpio)) {
  $antes = $playlists.Count
  Get-ChildItem -LiteralPath $paramLimpio -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { @('.m3u', '.m3u8', '.pls') -contains $_.Extension.ToLower() -and $_.Name -notmatch '^winamp\.m3u8?$' } |
    ForEach-Object { Agregar-Playlist $_.BaseName $_.FullName 'Carpeta' }
  if ($playlists.Count -gt $antes) { Write-Host "Playlists sueltas en ${paramLimpio}: $($playlists.Count - $antes)" }
} elseif ($paramLimpio) {
  Write-Warning "La carpeta indicada en -CarpetaWinamp no existe: '$paramLimpio'"
}

foreach ($ceCrudo in $CarpetasExtra) {
  $ce = Limpiar-Ruta $ceCrudo
  if (-not (Test-Path -LiteralPath $ce)) { Write-Warning "No existe la carpeta: $ce"; continue }
  Get-ChildItem -LiteralPath $ce -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { @('.m3u', '.m3u8', '.pls') -contains $_.Extension.ToLower() } |
    ForEach-Object { Agregar-Playlist $_.BaseName $_.FullName 'Carpeta' }
}

if ($playlists.Count -eq 0) {
  Write-Warning 'No se encontro ninguna playlist. Si Winamp esta en otra ubicacion usa -CarpetaWinamp "<carpeta>" o -CarpetasExtra "<carpeta con .m3u>".'
  return
}

# --- Seleccion de playlists ------------------------------------------
Write-Host ""
Write-Host "Se encontraron $($playlists.Count) playlists:" -ForegroundColor White
Write-Host ""
for ($i = 0; $i -lt $playlists.Count; $i++) {
  $pl = $playlists[$i]
  Write-Host ("  [{0,3}] {1}" -f ($i+1), $pl.Titulo)
}
Write-Host ""
Write-Host "  [T]  Exportar todas" -ForegroundColor Cyan
Write-Host ""
Write-Host "  O ingresa los numeros separados por coma, o rangos (ej: 1,3,5-8)" -ForegroundColor Gray
$selPl = (Read-Host "Seleccion").Trim()

if ($selPl -match '^[tT]$' -or $selPl -eq '') {
  Write-Host "  Exportando todas las playlists." -ForegroundColor Green
} else {
  $seleccionadas = New-Object System.Collections.Generic.List[object]
  foreach ($parte in ($selPl -split ',')) {
    $parte = $parte.Trim()
    if ($parte -match '^(\d+)-(\d+)$') {
      $desde = [int]$matches[1]; $hasta = [int]$matches[2]
      for ($j = [math]::Min($desde,$hasta); $j -le [math]::Max($desde,$hasta); $j++) {
        if ($j -ge 1 -and $j -le $playlists.Count) { $seleccionadas.Add($playlists[$j-1]) }
      }
    } elseif ($parte -as [int]) {
      $n = [int]$parte
      if ($n -ge 1 -and $n -le $playlists.Count) { $seleccionadas.Add($playlists[$n-1]) }
    }
  }
  if ($seleccionadas.Count -eq 0) {
    Write-Warning "No se selecciono ninguna playlist valida."
    return
  }
  $playlists = $seleccionadas
  Write-Host "  $($playlists.Count) playlist(s) seleccionada(s)." -ForegroundColor Green
}
Write-Host ""

# --- Exportar ---
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$usados = @{}
$indice = New-Object System.Collections.Generic.List[object]
$copiados = @{}

foreach ($pl in $playlists) {
  $items = Leer-Playlist $pl.Archivo
  $nombre = Limpiar-Nombre $pl.Titulo
  $final = $nombre; $i = 2
  while ($usados.ContainsKey($final.ToLower())) { $final = "$nombre ($i)"; $i++ }
  $usados[$final.ToLower()] = $true

  $out = New-Object System.Collections.Generic.List[string]
  $out.Add('#EXTM3U')
  $infoOrig = Get-Item -LiteralPath $pl.Archivo
  $fechaCreacion = $infoOrig.CreationTime
  $fechaModif = $infoOrig.LastWriteTime
  $fecha = if ($fechaModif -lt $fechaCreacion) { $fechaModif } else { $fechaCreacion }
  $out.Add("#PLAYLIST:$($pl.Titulo)")
  $out.Add("#FECHA:$($fecha.ToString('yyyy-MM-ddTHH:mm:ss'))")
  $faltan = 0
  foreach ($it in $items) {
    $tit = if ($it.Titulo) { $it.Titulo } else { [IO.Path]::GetFileNameWithoutExtension($it.Ruta) }
    $out.Add("#EXTINF:$($it.Segundos),$tit")
    $out.Add($it.Ruta)
    $existe = $false
    try { $existe = Test-Path -LiteralPath $it.Ruta } catch {}
    if (-not $existe) { $faltan++ }
    elseif ($CopiarMusica -and -not $copiados.ContainsKey($it.Ruta)) {
      $rel = $it.Ruta -replace '^[a-zA-Z]:\\', '' -replace '^\\\\[^\\]+\\[^\\]+\\', ''
      $dst = Join-Path (Join-Path $Destino 'musica') $rel
      New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
      Copy-Item -LiteralPath $it.Ruta -Destination $dst -Force
      $copiados[$it.Ruta] = $true
    }
  }
  $archivoSalida = Join-Path $Destino "$final.m3u8"
  [IO.File]::WriteAllLines($archivoSalida, $out, $utf8Bom)
  # El archivo exportado conserva las fechas del original.
  try {
    [IO.File]::SetCreationTime($archivoSalida, $fecha)
    [IO.File]::SetLastWriteTime($archivoSalida, $fechaModif)
  } catch {}
  $indice.Add([pscustomobject]@{
    Playlist = $pl.Titulo; Archivo = "$final.m3u8"; Temas = $items.Count; NoEncontradosEnDisco = $faltan
    Fecha = $fecha.ToString('yyyy-MM-dd HH:mm'); FechaCreacionArchivo = $fechaCreacion.ToString('yyyy-MM-dd HH:mm'); FechaModificacionArchivo = $fechaModif.ToString('yyyy-MM-dd HH:mm')
    Origen = $pl.Origen; ArchivoOriginal = $pl.Archivo
  })
  Write-Host ("  {0,-45} {1}  {2,4} temas{3}" -f $pl.Titulo, $fecha.ToString('yyyy-MM-dd'), $items.Count, $(if ($faltan) { "  ($faltan no existen en disco)" } else { '' }))
}

$indice | Export-Csv -Path (Join-Path $Destino 'indice.csv') -NoTypeInformation -Encoding UTF8 -Delimiter ';'

Write-Host ''
Write-Host "Listo: $($indice.Count) playlists exportadas a $Destino"
if ($CopiarMusica) { Write-Host "Archivos de audio copiados: $($copiados.Count)" }

if (-not $SinZip) {
  $zip = "$Destino.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path $Destino '*') -DestinationPath $zip
  Write-Host "Zip: $zip"
}
