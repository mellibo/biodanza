# publicar-biosoft.ps1
# Build de UI-react y copia biosoft.html a Google Drive (H:) para distribucion.
# Uso: .\scripts\publicar-biosoft.ps1  (desde la raiz del repo)

$DIR_DRIVE           = "H:\Mi unidad\biosoft"
$DIR_INSTALADOR      = "H:\Mi unidad\Instalador biosoft"
$DESTINO             = "$DIR_DRIVE\biosoft.html"
$DESTINO_INSTALLER   = "$DIR_DRIVE\instala-biosoft.ps1"
$DESTINO_XLSX        = "$DIR_DRIVE\EquivalenciasDeNombres.xlsx"
$DESTINO_WINAMP      = "$DIR_DRIVE\exportar-playlists-winamp.ps1"
$DESTINO_INSTALLER2  = "$DIR_INSTALADOR\instala-biosoft.ps1"
$DESTINO_WINAMP2     = "$DIR_INSTALADOR\exportar-playlists-winamp.ps1"
$DESTINO_TUTORIAL    = "$DIR_DRIVE\tutorial.html"
$DESTINO_TUTORIAL2   = "$DIR_INSTALADOR\tutorial.html"
$UI_DIR  = Join-Path $PSScriptRoot "..\UI-react"
$BUILD   = Join-Path $UI_DIR "dist\index.html"
$XLSX_SRC      = Join-Path $UI_DIR "dist\EquivalenciasDeNombres.xlsx"
$INSTALLER_SRC = Join-Path $PSScriptRoot "instala-biosoft.ps1"
$WINAMP_SRC    = Join-Path $PSScriptRoot "exportar-playlists-winamp.ps1"

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Build ---
Write-Host "Building UI-react ..." -ForegroundColor Cyan
Push-Location $UI_DIR
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build fallo (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

if (-not (Test-Path $BUILD)) {
    throw "No se encontro $BUILD despues del build."
}

# --- Copiar a Drive ---
$dirDestino = Split-Path $DESTINO -Parent
if (-not (Test-Path $dirDestino)) {
    Write-Host "Creando carpeta $dirDestino ..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path $dirDestino -Force | Out-Null
}

Write-Host "Copiando a $DESTINO ..." -ForegroundColor Cyan
Copy-Item $BUILD $DESTINO -Force

$tam = "{0:N0} KB" -f ((Get-Item $DESTINO).Length / 1KB)
Write-Host "[OK] biosoft.html publicado ($tam)" -ForegroundColor Green

# --- Copiar scripts con UTF-8 BOM (PS 5.1 requiere BOM para leer UTF-8) ---
Write-Host "Copiando instalador a $DESTINO_INSTALLER ..." -ForegroundColor Cyan
Get-Content $INSTALLER_SRC -Raw | Out-File $DESTINO_INSTALLER -Encoding UTF8 -Force
$tam2 = "{0:N0} KB" -f ((Get-Item $DESTINO_INSTALLER).Length / 1KB)
Write-Host "[OK] instala-biosoft.ps1 publicado ($tam2)" -ForegroundColor Green

Write-Host "Copiando exportar-playlists-winamp.ps1 a $DESTINO_WINAMP ..." -ForegroundColor Cyan
Get-Content $WINAMP_SRC -Raw | Out-File $DESTINO_WINAMP -Encoding UTF8 -Force
$tam3 = "{0:N0} KB" -f ((Get-Item $DESTINO_WINAMP).Length / 1KB)
Write-Host "[OK] exportar-playlists-winamp.ps1 publicado ($tam3)" -ForegroundColor Green

# --- Copiar EquivalenciasDeNombres.xlsx (binario, copia directa) ---
if (Test-Path $XLSX_SRC) {
    Write-Host "Copiando EquivalenciasDeNombres.xlsx a $DESTINO_XLSX ..." -ForegroundColor Cyan
    Copy-Item $XLSX_SRC $DESTINO_XLSX -Force
    $tam4 = "{0:N0} KB" -f ((Get-Item $DESTINO_XLSX).Length / 1KB)
    Write-Host "[OK] EquivalenciasDeNombres.xlsx publicado ($tam4)" -ForegroundColor Green
} else {
    Write-Host "[!] No se encontro $XLSX_SRC -- saltando xlsx" -ForegroundColor Yellow
}

# --- Copiar instaladores a "Instalador biosoft" ---
if (-not (Test-Path $DIR_INSTALADOR)) {
    New-Item -ItemType Directory -Path $DIR_INSTALADOR -Force | Out-Null
}
Write-Host "Copiando instalador a $DESTINO_INSTALLER2 ..." -ForegroundColor Cyan
Get-Content $INSTALLER_SRC -Raw | Out-File $DESTINO_INSTALLER2 -Encoding UTF8 -Force
Write-Host "[OK] instala-biosoft.ps1 copiado a Instalador biosoft" -ForegroundColor Green

Write-Host "Copiando exportar-playlists-winamp.ps1 a $DESTINO_WINAMP2 ..." -ForegroundColor Cyan
Get-Content $WINAMP_SRC -Raw | Out-File $DESTINO_WINAMP2 -Encoding UTF8 -Force
Write-Host "[OK] exportar-playlists-winamp.ps1 copiado a Instalador biosoft" -ForegroundColor Green

# --- Copiar tutorial ---
$TUTORIAL_SRC = Join-Path $UI_DIR "tutorial.html"
if (Test-Path $TUTORIAL_SRC) {
    Write-Host "Copiando tutorial.html a $DESTINO_TUTORIAL ..." -ForegroundColor Cyan
    Copy-Item $TUTORIAL_SRC $DESTINO_TUTORIAL -Force
    $tamT = "{0:N0} KB" -f ((Get-Item $DESTINO_TUTORIAL).Length / 1KB)
    Write-Host "[OK] tutorial.html publicado ($tamT)" -ForegroundColor Green

    Write-Host "Copiando tutorial.html a $DESTINO_TUTORIAL2 ..." -ForegroundColor Cyan
    Copy-Item $TUTORIAL_SRC $DESTINO_TUTORIAL2 -Force
    Write-Host "[OK] tutorial.html copiado a Instalador biosoft" -ForegroundColor Green
} else {
    Write-Host "[!] No se encontro $TUTORIAL_SRC -- saltando tutorial" -ForegroundColor Yellow
}
