# publicar-biosoft.ps1
# Build de UI-react y copia biosoft.html a Google Drive (H:) para distribucion.
# Uso: .\scripts\publicar-biosoft.ps1  (desde la raiz del repo)

$DESTINO           = "H:\Mi unidad\biosoft\biosoft.html"
$DESTINO_INSTALLER = "H:\Mi unidad\biosoft\instala-biosoft.ps1"
$UI_DIR  = Join-Path $PSScriptRoot "..\UI-react"
$BUILD   = Join-Path $UI_DIR "dist\index.html"
$INSTALLER_SRC = Join-Path $PSScriptRoot "instala-biosoft.ps1"

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

# --- Copiar instalador con UTF-8 BOM para que PS 5.1 lo lea correctamente ---
Write-Host "Copiando instalador a $DESTINO_INSTALLER ..." -ForegroundColor Cyan
Get-Content $INSTALLER_SRC -Raw | Out-File $DESTINO_INSTALLER -Encoding UTF8 -Force
$tam2 = "{0:N0} KB" -f ((Get-Item $DESTINO_INSTALLER).Length / 1KB)
Write-Host "[OK] instala-biosoft.ps1 publicado ($tam2)" -ForegroundColor Green
