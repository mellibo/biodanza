# instala-biosoft.ps1
# Instala Biosoft (biosoft.html + colecciones de musica) en Windows 10/11.
# Uso: clic derecho -> "Ejecutar con PowerShell"

# ─── CONFIGURACIÓN ────────────────────────────────────────────────
# Ruta en Drive donde vive biosoft.html (el build dist/index.html subido a Drive)
$HTML_FUENTE = "G:\Mi unidad\Biodanza\biosoft\biosoft.html"

# Carpeta de Drive que contiene las subcarpetas de cada colección (IBF, BsAs, CPAZ, HLB, JEXP)
$MUSICA_FUENTE = "G:\Mi unidad\Biodanza\Musica"
# ──────────────────────────────────────────────────────────────────

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helpers ──────────────────────────────────────────────────────

function Write-Header {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║          INSTALADOR BIOSOFT               ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Format-Bytes($bytes) {
    if ($bytes -ge 1GB) { "{0:N1} GB" -f ($bytes / 1GB) }
    elseif ($bytes -ge 1MB) { "{0:N0} MB" -f ($bytes / 1MB) }
    else { "{0:N0} KB" -f ($bytes / 1KB) }
}

function Format-Duracion($segundos) {
    $h = [math]::Floor($segundos / 3600)
    $m = [math]::Floor(($segundos % 3600) / 60)
    $s = $segundos % 60
    if ($h -gt 0)  { "${h}h ${m}m" }
    elseif ($m -gt 0) { "${m}m ${s}s" }
    else { "${s}s" }
}

function Get-TamañoCarpeta($path) {
    try {
        (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue |
         Measure-Object -Property Length -Sum).Sum
    } catch { 0 }
}

# Velocidad de referencia para estimar tiempo de copia dentro del mismo Drive (~50 MB/s)
$VELOCIDAD_BYTES_SEG = 50 * 1MB

# ── 1. Header ─────────────────────────────────────────────────────

Write-Header

# ── 2. Verificar PowerShell ────────────────────────────────────────

if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "ERROR: Se requiere PowerShell 5 o superior (Windows 10 incluye PS 5.1)." -ForegroundColor Red
    Read-Host "Presioná Enter para salir"
    exit 1
}

# ── 3. Verificar fuentes ───────────────────────────────────────────

if (-not (Test-Path $HTML_FUENTE)) {
    Write-Host "ERROR: No se encontró $HTML_FUENTE" -ForegroundColor Red
    Write-Host "Asegurate de que Google Drive esté sincronizado y la unidad G: accesible." -ForegroundColor Yellow
    Read-Host "Presioná Enter para salir"
    exit 1
}

if (-not (Test-Path $MUSICA_FUENTE)) {
    Write-Host "ERROR: No se encontró la carpeta de musica: $MUSICA_FUENTE" -ForegroundColor Red
    Write-Host "Asegurate de que Google Drive esté sincronizado y la unidad G: accesible." -ForegroundColor Yellow
    Read-Host "Presioná Enter para salir"
    exit 1
}

# ── 4. Elegir carpeta de instalación ──────────────────────────────

Write-Host "¿Dónde instalar Biosoft?" -ForegroundColor White
Write-Host ""

$opciones = @()
# G: primero si existe
if (Test-Path "G:\") {
    $opciones += "G:\biosoft"
}
$opciones += "C:\biosoft"
$opciones += "D:\biosoft"
$opciones += "Ruta personalizada"

for ($i = 0; $i -lt $opciones.Count; $i++) {
    $etiqueta = if ($opciones[$i] -eq "G:\biosoft") { "$($opciones[$i])  ← Google Drive (recomendado)" } else { $opciones[$i] }
    Write-Host "  [$($i+1)] $etiqueta"
}
Write-Host ""

do {
    $sel = Read-Host "Elegí una opción (1-$($opciones.Count))"
    $selNum = $sel -as [int]
} while ($selNum -lt 1 -or $selNum -gt $opciones.Count)

if ($opciones[$selNum - 1] -eq "Ruta personalizada") {
    $destino = Read-Host "Ingresá la ruta completa de instalación"
    $destino = $destino.TrimEnd('\')
} else {
    $destino = $opciones[$selNum - 1]
}

Write-Host ""

# ── 5. Detectar reinstalación ──────────────────────────────────────

$htmlDestino = "$destino\biosoft.html"
if (Test-Path $htmlDestino) {
    Write-Host "Ya existe una instalación en $destino" -ForegroundColor Yellow
    $resp = Read-Host "¿Actualizar la instalación existente? (S/N)"
    if ($resp -notmatch '^[sS]') {
        Write-Host "Instalación cancelada." -ForegroundColor Gray
        Read-Host "Presioná Enter para salir"
        exit 0
    }
}

# ── 6. Crear estructura y copiar HTML ─────────────────────────────

Write-Host "Creando carpeta $destino ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "$destino\musica" -Force | Out-Null

Write-Host "Copiando biosoft.html ..." -ForegroundColor Cyan
Copy-Item $HTML_FUENTE $htmlDestino -Force
Write-Host "  ✓ biosoft.html copiado." -ForegroundColor Green

# ── 7. Listar colecciones disponibles ─────────────────────────────

Write-Host ""
Write-Host "Colecciones de música disponibles:" -ForegroundColor White
Write-Host ""

$colecciones = @(Get-ChildItem $MUSICA_FUENTE -Directory -ErrorAction SilentlyContinue)

if ($colecciones.Count -eq 0) {
    Write-Host "  (No se encontraron colecciones en $MUSICA_FUENTE)" -ForegroundColor Gray
} else {
    Write-Host "  Calculando tamaños, espere..." -ForegroundColor Gray
    $infoColecciones = @()
    foreach ($col in $colecciones) {
        $bytes = Get-TamañoCarpeta $col.FullName
        $infoColecciones += [pscustomobject]@{
            Nombre  = $col.Name
            FullName = $col.FullName
            Bytes   = $bytes
        }
    }
    # Limpiar línea "Calculando..."
    Write-Host "`r  " -NoNewline

    for ($i = 0; $i -lt $infoColecciones.Count; $i++) {
        $info = $infoColecciones[$i]
        $tam  = Format-Bytes $info.Bytes
        $seg  = if ($info.Bytes -gt 0) { [math]::Max(1, [math]::Ceiling($info.Bytes / $VELOCIDAD_BYTES_SEG)) } else { 0 }
        $dur  = if ($seg -gt 0) { "~$(Format-Duracion $seg)" } else { "tamaño desconocido" }
        Write-Host ("  [{0}] {1,-10} — {2,8}  ({3})" -f ($i+1), $info.Nombre, $tam, $dur)
    }
    Write-Host ""
    Write-Host "  Ingresá los números separados por coma (ej: 1,3) o Enter para ninguna." -ForegroundColor Gray
    $selCol = Read-Host "Colecciones a instalar"
}

# ── 8. Copiar colecciones elegidas ─────────────────────────────────

if ($colecciones.Count -gt 0 -and $selCol.Trim() -ne '') {
    $indices = $selCol -split ',' | ForEach-Object { $_.Trim() -as [int] } | Where-Object { $_ -ge 1 -and $_ -le $infoColecciones.Count }

    # Detectar si fuente y destino están en la misma unidad para ofrecer junction
    $mismaUnidad = $destino.Substring(0,1).ToUpper() -eq $MUSICA_FUENTE.Substring(0,1).ToUpper()
    $usarJunction = $false
    if ($mismaUnidad) {
        Write-Host ""
        Write-Host "Fuente y destino están en la misma unidad ($($destino.Substring(0,2)))." -ForegroundColor Cyan
        Write-Host "Se puede vincular las carpetas (junction) en lugar de copiar para ahorrar espacio." -ForegroundColor Cyan
        $respJ = Read-Host "¿Usar junction en lugar de copiar? (S/N, recomendado S)"
        $usarJunction = $respJ -match '^[sS]'
    }

    Write-Host ""
    foreach ($idx in $indices) {
        $info = $infoColecciones[$idx - 1]
        $destinoCol = "$destino\musica\$($info.Nombre)"
        Write-Host "Procesando $($info.Nombre) ..." -ForegroundColor Cyan

        if ($usarJunction) {
            if (Test-Path $destinoCol) {
                Remove-Item $destinoCol -Recurse -Force -ErrorAction SilentlyContinue
            }
            try {
                cmd /c "mklink /J `"$destinoCol`" `"$($info.FullName)`"" | Out-Null
                Write-Host "  ✓ Junction creada: $destinoCol -> $($info.FullName)" -ForegroundColor Green
            } catch {
                Write-Host "  ! No se pudo crear junction, copiando en su lugar..." -ForegroundColor Yellow
                try {
                    Copy-Item $info.FullName $destinoCol -Recurse -Force
                    Write-Host "  ✓ Copiada." -ForegroundColor Green
                } catch {
                    Write-Host "  ✗ Error copiando $($info.Nombre): $_" -ForegroundColor Red
                }
            }
        } else {
            try {
                Copy-Item $info.FullName $destinoCol -Recurse -Force
                Write-Host "  ✓ Copiada." -ForegroundColor Green
            } catch {
                Write-Host "  ✗ Error copiando $($info.Nombre): $_" -ForegroundColor Red
            }
        }
    }
}

# ── 9. Acceso directo en el escritorio ────────────────────────────

Write-Host ""
Write-Host "Creando acceso directo en el escritorio ..." -ForegroundColor Cyan
try {
    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut("$env:USERPROFILE\Desktop\Biosoft.lnk")
    $lnk.TargetPath   = $htmlDestino
    $lnk.IconLocation = "%SystemRoot%\system32\shell32.dll,116"
    $lnk.Description  = "Biosoft — Planificador de clases de Biodanza"
    $lnk.Save()
    Write-Host "  ✓ Acceso directo creado en el escritorio." -ForegroundColor Green
} catch {
    Write-Host "  ! No se pudo crear el acceso directo: $_" -ForegroundColor Yellow
}

# ── 10. Resumen ────────────────────────────────────────────────────

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Instalación completada." -ForegroundColor Green
Write-Host "  Biosoft instalado en: $destino" -ForegroundColor White
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$respAbrir = Read-Host "¿Abrir Biosoft ahora? (S/N)"
if ($respAbrir -match '^[sS]') {
    Start-Process $htmlDestino
}

Read-Host "Presioná Enter para salir"
