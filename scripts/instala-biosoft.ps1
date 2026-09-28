# instala-biosoft.ps1
# Instala Biosoft en Windows 10/11 descargando desde Google Drive.
# Uso: doble clic en "Instalar Biosoft.bat"

# ─── CONFIGURACIÓN ────────────────────────────────────────────────
$HTML_DRIVE_ID      = "REEMPLAZAR_CON_FILE_ID_DE_biosoft.html"
$COLECCIONES_FOLDER = "REEMPLAZAR_CON_FOLDER_ID_DE_colecciones_de_musica"
$DRIVE_API_KEY      = "REEMPLAZAR_CON_API_KEY"
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
    else { "menos de 1 min" }
}

# Velocidad de referencia para estimar tiempo de descarga (~5 Mbps = 625 KB/s)
$VELOCIDAD_BYTES_SEG = 625 * 1KB

function Invoke-DriveDownload($fileId, $destPath, $descripcion) {
    $url = "https://drive.usercontent.google.com/download?id=$fileId&export=download&confirm=t"
    Write-Host "  Descargando $descripcion ..." -ForegroundColor Gray
    $ProgressPreference = 'SilentlyContinue'   # evita la barra lenta de PS5
    try {
        # WebClient.DownloadFile transmite directo a disco sin cargar en memoria
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($url, $destPath)
        # Verificar que no nos devolvió una página HTML de error de Drive
        $header = [System.IO.File]::ReadAllBytes($destPath) | Select-Object -First 5
        $htmlMagic = [byte[]]@(0x3C, 0x21, 0x44, 0x4F, 0x43)   # <!DOC
        $htmlMagic2 = [byte[]]@(0x3C, 0x68, 0x74, 0x6D, 0x6C)  # <html
        if (($header[0] -eq $htmlMagic[0] -and $header[1] -eq $htmlMagic[1]) -or
            ($header[0] -eq $htmlMagic2[0] -and $header[1] -eq $htmlMagic2[1])) {
            Remove-Item $destPath -Force
            throw "Drive devolvió una página HTML en lugar del archivo. Verificá que el archivo esté compartido como público."
        }
    } finally {
        if ($wc) { $wc.Dispose() }
    }
}

# ── 1. Header ─────────────────────────────────────────────────────

Write-Header

# ── 2. Verificar PS 5+ ────────────────────────────────────────────

if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "ERROR: Se requiere PowerShell 5 o superior (Windows 10 lo incluye)." -ForegroundColor Red
    Read-Host "Presioná Enter para salir"
    exit 1
}

# ── 3. Verificar configuración ────────────────────────────────────

if ($HTML_DRIVE_ID -like "REEMPLAZAR*" -or $COLECCIONES_FOLDER -like "REEMPLAZAR*" -or $DRIVE_API_KEY -like "REEMPLAZAR*") {
    Write-Host "ERROR: El instalador no está configurado (IDs de Drive y API Key vacíos)." -ForegroundColor Red
    Write-Host "Contactá al administrador para obtener una versión configurada." -ForegroundColor Yellow
    Read-Host "Presioná Enter para salir"
    exit 1
}

# ── 4. Elegir carpeta de instalación ──────────────────────────────

Write-Host "¿Dónde instalar Biosoft?" -ForegroundColor White
Write-Host ""

$opciones = @()
foreach ($letra in @('G','C','D','E')) {
    if (Test-Path "${letra}:\") {
        $tag = if ($letra -eq 'G') { "  ← Google Drive (recomendado)" } else { "" }
        $opciones += [pscustomobject]@{ Letra = $letra; Ruta = "${letra}:\biosoft"; Tag = $tag }
    }
}
$opciones += [pscustomobject]@{ Letra = ''; Ruta = 'Ruta personalizada'; Tag = '' }

for ($i = 0; $i -lt $opciones.Count; $i++) {
    Write-Host ("  [{0}] {1}{2}" -f ($i+1), $opciones[$i].Ruta, $opciones[$i].Tag)
}
Write-Host ""

do {
    $sel = Read-Host "Elegí una opción (1-$($opciones.Count))"
    $selNum = $sel -as [int]
} while ($selNum -lt 1 -or $selNum -gt $opciones.Count)

if ($opciones[$selNum - 1].Ruta -eq 'Ruta personalizada') {
    $destino = (Read-Host "Ingresá la ruta completa").TrimEnd('\')
} else {
    $destino = $opciones[$selNum - 1].Ruta
}

Write-Host ""

# ── 5. Detectar reinstalación ─────────────────────────────────────

$htmlDestino = "$destino\biosoft.html"
if (Test-Path $htmlDestino) {
    Write-Host "Ya existe una instalación en $destino" -ForegroundColor Yellow
    $resp = Read-Host "¿Actualizar? (S/N)"
    if ($resp -notmatch '^[sS]') {
        Write-Host "Cancelado." -ForegroundColor Gray
        Read-Host "Presioná Enter para salir"
        exit 0
    }
}

# ── 6. Crear estructura ───────────────────────────────────────────

Write-Host "Creando carpeta $destino ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "$destino\musica" -Force | Out-Null

# ── 7. Descargar biosoft.html ─────────────────────────────────────

Write-Host "Descargando biosoft.html ..." -ForegroundColor Cyan
try {
    Invoke-DriveDownload $HTML_DRIVE_ID $htmlDestino "biosoft.html"
    Write-Host "  ✓ biosoft.html descargado." -ForegroundColor Green
} catch {
    Write-Host "  ✗ Error: $_" -ForegroundColor Red
    Read-Host "Presioná Enter para salir"
    exit 1
}

# ── 8. Listar colecciones disponibles vía Drive API ───────────────

Write-Host ""
Write-Host "Consultando colecciones disponibles ..." -ForegroundColor Cyan

try {
    $apiUrl = "https://www.googleapis.com/drive/v3/files?q='$COLECCIONES_FOLDER'+in+parents+and+trashed=false&fields=files(id,name,size)&orderBy=name&key=$DRIVE_API_KEY"
    $ProgressPreference = 'SilentlyContinue'
    $resp = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing
    $zips = @($resp.files | Where-Object { $_.name -like "*.zip" })
} catch {
    Write-Host "  ! No se pudieron listar las colecciones: $_" -ForegroundColor Yellow
    Write-Host "  Verificá la conexión a internet y la configuración del instalador." -ForegroundColor Yellow
    $zips = @()
}

$selCol = ''
if ($zips.Count -eq 0) {
    Write-Host "  (No se encontraron colecciones disponibles)" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Colecciones disponibles:" -ForegroundColor White
    Write-Host ""
    for ($i = 0; $i -lt $zips.Count; $i++) {
        $z    = $zips[$i]
        $bytes = $z.size -as [long]
        $tam   = if ($bytes -gt 0) { Format-Bytes $bytes } else { "tamaño desconocido" }
        $dur   = if ($bytes -gt 0) { "~$(Format-Duracion ([math]::Max(1,[math]::Ceiling($bytes / $VELOCIDAD_BYTES_SEG))))" } else { "" }
        Write-Host ("  [{0}] {1,-12} — {2,8}  ({3})" -f ($i+1), ($z.name -replace '\.zip$',''), $tam, $dur)
    }
    Write-Host ""
    Write-Host "  Ingresá los números separados por coma (ej: 1,3) o Enter para ninguna." -ForegroundColor Gray
    $selCol = Read-Host "Colecciones a instalar"
}

# ── 9. Descargar y extraer colecciones elegidas ───────────────────

if ($selCol.Trim() -ne '' -and $zips.Count -gt 0) {
    $indices = $selCol -split ',' |
               ForEach-Object { $_.Trim() -as [int] } |
               Where-Object { $_ -ge 1 -and $_ -le $zips.Count }

    Write-Host ""
    foreach ($idx in $indices) {
        $zip     = $zips[$idx - 1]
        $nombre  = $zip.name -replace '\.zip$', ''
        $tmpZip  = "$env:TEMP\biosoft-$($zip.name)"
        Write-Host "Instalando colección $nombre ..." -ForegroundColor Cyan
        try {
            Invoke-DriveDownload $zip.id $tmpZip $zip.name
            Write-Host "  Extrayendo ..." -ForegroundColor Gray
            Expand-Archive -Path $tmpZip -DestinationPath "$destino\musica" -Force
            Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ $nombre instalada." -ForegroundColor Green
        } catch {
            Write-Host "  ✗ Error instalando $nombre : $_" -ForegroundColor Red
            Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
        }
    }
}

# ── 10. Acceso directo en el escritorio ───────────────────────────

Write-Host ""
Write-Host "Creando acceso directo en el escritorio ..." -ForegroundColor Cyan
try {
    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut("$env:USERPROFILE\Desktop\Biosoft.lnk")
    $lnk.TargetPath   = $htmlDestino
    $lnk.IconLocation = "%SystemRoot%\system32\shell32.dll,116"
    $lnk.Description  = "Biosoft — Planificador de clases de Biodanza"
    $lnk.Save()
    Write-Host "  ✓ Acceso directo creado." -ForegroundColor Green
} catch {
    Write-Host "  ! No se pudo crear el acceso directo: $_" -ForegroundColor Yellow
}

# ── 11. Resumen ────────────────────────────────────────────────────

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
