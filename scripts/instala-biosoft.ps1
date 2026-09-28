# instala-biosoft.ps1
# Instala Biosoft en Windows 10/11 descargando desde Google Drive.
# Uso: doble clic en "Instalar Biosoft.bat"

# --- CONFIGURACION -----------------------------------------------
$HTML_DRIVE_ID = "REEMPLAZAR_CON_FILE_ID_DE_biosoft.html"

$COLECCIONES = @(
    [pscustomobject]@{ Nombre="IBF";  Id="REEMPLAZAR_CON_FILE_ID_IBF.zip"  }
    [pscustomobject]@{ Nombre="BsAs"; Id="REEMPLAZAR_CON_FILE_ID_BsAs.zip" }
    [pscustomobject]@{ Nombre="CPAZ"; Id="REEMPLAZAR_CON_FILE_ID_CPAZ.zip" }
    [pscustomobject]@{ Nombre="HLB";  Id="REEMPLAZAR_CON_FILE_ID_HLB.zip"  }
    [pscustomobject]@{ Nombre="JEXP"; Id="REEMPLAZAR_CON_FILE_ID_JEXP.zip" }
)
# -----------------------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
    $wc = $null
    try {
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($url, $destPath)
        # Verificar que no devolvio una pagina HTML de error de Drive
        $primeros = [System.IO.File]::ReadAllBytes($destPath) | Select-Object -First 5
        if ($primeros[0] -eq 0x3C) {   # '<' = posible HTML
            Remove-Item $destPath -Force
            throw "Drive devolvio HTML en lugar del archivo. Verifica que el archivo este compartido como publico."
        }
    } finally {
        if ($wc) { $wc.Dispose() }
    }
}

function Get-DriveFileSize($fileId) {
    # HEAD request para obtener el tamano sin descargar
    try {
        $url = "https://drive.usercontent.google.com/download?id=$fileId&export=download&confirm=t"
        $req = [System.Net.WebRequest]::Create($url)
        $req.Method = "HEAD"
        $req.AllowAutoRedirect = $true
        $resp = $req.GetResponse()
        $size = $resp.ContentLength
        $resp.Close()
        return $size
    } catch {
        return -1
    }
}

# --- 1. Header ---------------------------------------------------

Clear-Host
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "         INSTALADOR BIOSOFT              " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# --- 2. Verificar PS 5+ ------------------------------------------

if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Host "ERROR: Se requiere PowerShell 5 o superior (Windows 10 lo incluye)." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# --- 3. Verificar configuracion ----------------------------------

if ($HTML_DRIVE_ID -like "REEMPLAZAR*") {
    Write-Host "ERROR: El instalador no esta configurado." -ForegroundColor Red
    Write-Host "Contacta al administrador para obtener una version configurada." -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# --- 4. Elegir carpeta de instalacion ----------------------------

Write-Host "Donde instalar Biosoft?" -ForegroundColor White
Write-Host ""

$opciones = @()
foreach ($letra in @('H','C','D','E')) {
    if (Test-Path "${letra}:\") {
        $tag = if ($letra -eq 'H') { "  <- Google Drive (recomendado)" } else { "" }
        $opciones += [pscustomobject]@{ Ruta = "${letra}:\biosoft"; Tag = $tag }
    }
}
$opciones += [pscustomobject]@{ Ruta = 'Ruta personalizada'; Tag = '' }

for ($i = 0; $i -lt $opciones.Count; $i++) {
    Write-Host ("  [{0}] {1}{2}" -f ($i+1), $opciones[$i].Ruta, $opciones[$i].Tag)
}
Write-Host ""

do {
    $sel = Read-Host "Elegi una opcion (1-$($opciones.Count))"
    $selNum = $sel -as [int]
} while ($selNum -lt 1 -or $selNum -gt $opciones.Count)

if ($opciones[$selNum - 1].Ruta -eq 'Ruta personalizada') {
    $destino = (Read-Host "Ingresa la ruta completa").TrimEnd('\')
} else {
    $destino = $opciones[$selNum - 1].Ruta
}

Write-Host ""

# --- 5. Detectar reinstalacion -----------------------------------

$htmlDestino = "$destino\biosoft.html"
if (Test-Path $htmlDestino) {
    Write-Host "Ya existe una instalacion en $destino" -ForegroundColor Yellow
    $resp = Read-Host "Actualizar? (S/N)"
    if ($resp -notmatch '^[sS]') {
        Write-Host "Cancelado." -ForegroundColor Gray
        Read-Host "Presiona Enter para salir"
        exit 0
    }
}

# --- 6. Crear estructura -----------------------------------------

Write-Host "Creando carpeta $destino ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "$destino\musica" -Force | Out-Null

# --- 7. Descargar biosoft.html -----------------------------------

Write-Host "Descargando biosoft.html ..." -ForegroundColor Cyan
try {
    Invoke-DriveDownload $HTML_DRIVE_ID $htmlDestino "biosoft.html"
    Write-Host "  [OK] biosoft.html descargado." -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $_" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# --- 8. Mostrar colecciones disponibles --------------------------

Write-Host ""
Write-Host "Colecciones disponibles:" -ForegroundColor White
Write-Host ""
Write-Host "  Consultando tamanos, espere..." -ForegroundColor Gray

$infos = @()
foreach ($col in $COLECCIONES) {
    $bytes = Get-DriveFileSize $col.Id
    $infos += [pscustomobject]@{ Nombre=$col.Nombre; Id=$col.Id; Bytes=$bytes }
}

# Limpiar linea "Consultando..."
Write-Host "`r                                    " -NoNewline

for ($i = 0; $i -lt $infos.Count; $i++) {
    $info = $infos[$i]
    $tam  = if ($info.Bytes -gt 0) { Format-Bytes $info.Bytes } else { "tamano desconocido" }
    $dur  = if ($info.Bytes -gt 0) { "~$(Format-Duracion ([math]::Max(1,[math]::Ceiling($info.Bytes / $VELOCIDAD_BYTES_SEG))))" } else { "" }
    Write-Host ("  [{0}] {1,-10} - {2,8}  ({3})" -f ($i+1), $info.Nombre, $tam, $dur)
}

Write-Host ""
Write-Host "  Ingresa los numeros separados por coma (ej: 1,3) o Enter para ninguna." -ForegroundColor Gray
$selCol = Read-Host "Colecciones a instalar"

# --- 9. Descargar y extraer colecciones --------------------------

if ($selCol.Trim() -ne '') {
    $indices = $selCol -split ',' |
               ForEach-Object { $_.Trim() -as [int] } |
               Where-Object { $_ -ge 1 -and $_ -le $infos.Count }

    Write-Host ""
    foreach ($idx in $indices) {
        $info   = $infos[$idx - 1]
        $tmpZip = "$env:TEMP\biosoft-$($info.Nombre).zip"
        Write-Host "Instalando coleccion $($info.Nombre) ..." -ForegroundColor Cyan
        try {
            Invoke-DriveDownload $info.Id $tmpZip "$($info.Nombre).zip"
            Write-Host "  Extrayendo ..." -ForegroundColor Gray
            Expand-Archive -Path $tmpZip -DestinationPath "$destino\musica" -Force
            Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
            Write-Host "  [OK] $($info.Nombre) instalada." -ForegroundColor Green
        } catch {
            Write-Host "  [ERROR] instalando $($info.Nombre): $_" -ForegroundColor Red
            Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
        }
    }
}

# --- 10. Acceso directo en el escritorio -------------------------

Write-Host ""
Write-Host "Creando acceso directo en el escritorio ..." -ForegroundColor Cyan
try {
    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut("$env:USERPROFILE\Desktop\Biosoft.lnk")
    $lnk.TargetPath   = $htmlDestino
    $lnk.IconLocation = "%SystemRoot%\system32\shell32.dll,116"
    $lnk.Description  = "Biosoft - Planificador de clases de Biodanza"
    $lnk.Save()
    Write-Host "  [OK] Acceso directo creado." -ForegroundColor Green
} catch {
    Write-Host "  [!] No se pudo crear el acceso directo: $_" -ForegroundColor Yellow
}

# --- 11. Resumen -------------------------------------------------

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Instalacion completada." -ForegroundColor Green
Write-Host "  Biosoft instalado en: $destino" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$respAbrir = Read-Host "Abrir Biosoft ahora? (S/N)"
if ($respAbrir -match '^[sS]') {
    Start-Process $htmlDestino
}

Read-Host "Presiona Enter para salir"
