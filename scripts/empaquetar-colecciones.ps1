# empaquetar-colecciones.ps1
# Genera o actualiza los zips de cada coleccion de musica en la carpeta de distribucion.
# Origen: UI\musica\ del repo (subcarpeta = una coleccion).
# Destino: carpeta en Drive desde donde los usuarios finales los descargan.
# Ejecutar desde cualquier lugar; usa rutas absolutas.

# --- CONFIGURACION -----------------------------------------------
# UI\musica\ del repo -- cada subcarpeta es una coleccion (IBF, BsAs, CPAZ, HLB, JEXP)
$MUSICA_FUENTE = Join-Path $PSScriptRoot "..\UI\musica"
$DESTINO_ZIPS  = "H:\Mi unidad\biosoft\colecciones de musica"
# -----------------------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Format-Bytes($bytes) {
    if ($bytes -ge 1GB) { "{0:N1} GB" -f ($bytes / 1GB) }
    elseif ($bytes -ge 1MB) { "{0:N0} MB" -f ($bytes / 1MB) }
    else { "{0:N0} KB" -f ($bytes / 1KB) }
}

# Detectar 7-Zip
$7z = $null
foreach ($candidate in @('7z', 'C:\Program Files\7-Zip\7z.exe', 'C:\Program Files (x86)\7-Zip\7z.exe')) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) { $7z = $candidate; break }
}

Write-Host ""
if ($7z) {
    Write-Host "7-Zip encontrado: $7z" -ForegroundColor Green
} else {
    Write-Host "7-Zip no encontrado -- se usara Compress-Archive (mas lento, limite ~4 GB por zip)." -ForegroundColor Yellow
}
Write-Host ""

# Verificar fuente
if (-not (Test-Path $MUSICA_FUENTE)) {
    Write-Host "ERROR: No se encontro $MUSICA_FUENTE" -ForegroundColor Red
    Write-Host "Asegurate de que Google Drive este sincronizado." -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Crear carpeta destino si no existe
New-Item -ItemType Directory -Path $DESTINO_ZIPS -Force | Out-Null

$colecciones = @(Get-ChildItem $MUSICA_FUENTE -Directory)
if ($colecciones.Count -eq 0) {
    Write-Host "No se encontraron colecciones en $MUSICA_FUENTE" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 0
}

Write-Host "Colecciones a empaquetar:" -ForegroundColor Cyan
foreach ($col in $colecciones) {
    Write-Host "  - $($col.Name)" -ForegroundColor White
}
Write-Host ""

$total   = $colecciones.Count
$idx     = 0
$errores = @()

foreach ($col in $colecciones) {
    $idx++
    $zipPath = "$DESTINO_ZIPS\$($col.Name).zip"
    $existe  = Test-Path $zipPath

    Write-Host "[$idx/$total] $($col.Name) -> $($col.Name).zip" -ForegroundColor Cyan
    if ($existe) {
        Write-Host "       (ya existe, actualizando)" -ForegroundColor Gray
    }

    $inicio = Get-Date
    $ok     = $false

    if ($7z) {
        # 7z a: agregar/actualizar; -r: recursivo; -mx=5: compresion media
        & $7z a -r -mx=5 $zipPath "$($col.FullName)\*" | Out-Null
        $ok = ($LASTEXITCODE -eq 0)
    } else {
        try {
            if ($existe) { Remove-Item $zipPath -Force }
            Compress-Archive -Path "$($col.FullName)\*" -DestinationPath $zipPath -CompressionLevel Optimal
            $ok = $true
        } catch {
            $ok = $false
            $errores += "$($col.Name): $_"
        }
    }

    $duracion = ((Get-Date) - $inicio).TotalSeconds
    if ($ok) {
        $tamZip = (Get-Item $zipPath).Length
        Write-Host ("       [OK] {0}  ({1:N0}s)" -f (Format-Bytes $tamZip), $duracion) -ForegroundColor Green
    } else {
        Write-Host "       [ERROR] empaquetando $($col.Name)" -ForegroundColor Red
        $errores += $col.Name
    }
}

Write-Host ""
if ($errores.Count -eq 0) {
    Write-Host "== Listo. $total zip(s) generados en:" -ForegroundColor Green
    Write-Host "   $DESTINO_ZIPS" -ForegroundColor White
} else {
    Write-Host "== Terminado con $($errores.Count) error(es):" -ForegroundColor Yellow
    $errores | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
}
Write-Host ""
Read-Host "Presiona Enter para salir"
