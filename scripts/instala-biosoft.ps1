# instala-biosoft.ps1
# Instala Biosoft en Windows 10/11 descargando desde Google Drive.
# Uso: doble clic en "Instalar Biosoft.bat"

# FolderBrowserDialog requiere modo STA. Si no estamos en STA, relanzar.
if ([System.Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    $args2 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', $MyInvocation.MyCommand.Path)
    Start-Process powershell.exe -ArgumentList $args2 -Wait -NoNewWindow
    exit
}

# --- CONFIGURACION -----------------------------------------------
$HTML_DRIVE_ID = "102kSTnhJKoozEjHSkCYlLQaSYfJUJIQ6"

$COLECCIONES = @(
    [pscustomobject]@{ Nombre="IBF";   Id="15QrdaK17bzq-xwymnhYUCbJnVD9pLl9_"; GBytes=1.98 }
    [pscustomobject]@{ Nombre="Areco"; Id="1Wz2KjDqBsp2gSgBDPq7pvTY6MCuNxPXM";  GBytes=1.46 }
    [pscustomobject]@{ Nombre="HLB";   Id="1Vz8Qxj5UWsbU29DD0ZNUQ3YmFVX23MsO";  GBytes=3.12 }
    [pscustomobject]@{ Nombre="JEXP";  Id="1I-yBIrUzi8_7QbLgtqBBM5raYg2P5Jp4";  GBytes=0.67 }
    [pscustomobject]@{ Nombre="BsAs";  Id="1F4tes2TuRL-vh-qPsPgLBcr79DRSFvEK";   GBytes=9.65 }
    [pscustomobject]@{ Nombre="CPAZ";  Id="1hCpBUUzZ0lM-u7DQ-_3WJERs9nB3yEz_";  GBytes=2.12 }
)
# -----------------------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Windows.Forms

function Select-Carpeta($descripcion) {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = $descripcion
    $dialog.ShowNewFolderButton = $false
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.SelectedPath
    }
    return $null
}

# Detectar 7-Zip (maneja caracteres especiales mejor que Expand-Archive)
$_7z = $null
foreach ($c in @('7z','C:\Program Files\7-Zip\7z.exe','C:\Program Files (x86)\7-Zip\7z.exe')) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { $_7z = $c; break }
}

function Expand-Zip($zipPath, $destDir) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    if ($_7z) {
        & $_7z x $zipPath "-o$destDir" -aoa -y | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "7-Zip fallo con codigo $LASTEXITCODE" }
    } else {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $destDir)
    }
}

function New-Junction($junctionPath, $targetPath) {
    if (Test-Path $junctionPath) {
        Remove-Item $junctionPath -Force -Recurse -ErrorAction SilentlyContinue
    }
    $result = cmd /c mklink /J "$junctionPath" "$targetPath" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el enlace: $result" }
}

function Find-MusicaRoot($carpeta) {
    # Busca el primer archivo de audio en el arbol y sube 2 niveles desde
    # su carpeta para obtener la raiz de colecciones (estructura tipica:
    # raiz/coleccion/CD/track.mp3 -- 2 niveles sobre el CD = raiz).
    $extensiones = @('.mp3','.flac','.ogg','.wav','.m4a','.wma','.aac')
    $primerAudio = Get-ChildItem $carpeta -Recurse -File -ErrorAction SilentlyContinue |
                   Where-Object { $extensiones -contains $_.Extension.ToLower() } |
                   Select-Object -First 1
    if (-not $primerAudio) { return $null }
    $p1 = Split-Path $primerAudio.DirectoryName -Parent
    $p2 = Split-Path $p1 -Parent
    if (-not $p2 -or -not (Test-Path $p2)) { return $carpeta }
    return $p2
}

function Get-ResumenMusica($carpeta) {
    $extensiones = @('.mp3','.flac','.ogg','.wav','.m4a','.wma','.aac')
    $resultado = @{}
    foreach ($sub in Get-ChildItem $carpeta -Directory -ErrorAction SilentlyContinue) {
        $count = @(Get-ChildItem $sub.FullName -Recurse -File -ErrorAction SilentlyContinue |
                  Where-Object { $extensiones -contains $_.Extension.ToLower() }).Count
        if ($count -gt 0) { $resultado[$sub.Name] = $count }
    }
    return $resultado
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

function Invoke-DriveDownload($fileId, $destPath, $descripcion, $minBytes = 102400) {
    $url = "https://drive.usercontent.google.com/download?id=$fileId&export=download&confirm=t"
    Write-Host "  $descripcion :" -NoNewline -ForegroundColor Gray

    $wc = New-Object System.Net.WebClient
    $global:_dlDone  = $false
    $global:_dlError = $null

    Register-ObjectEvent -InputObject $wc -EventName DownloadFileCompleted -SourceIdentifier "_BsDlDone" -Action {
        $global:_dlError = $Event.SourceEventArgs.Error
        $global:_dlDone  = $true
    } | Out-Null

    try {
        $wc.DownloadFileAsync([uri]$url, $destPath)

        $ultimo = 0
        while (-not $global:_dlDone) {
            Start-Sleep -Milliseconds 500
            if (Test-Path $destPath) {
                $tam = (Get-Item $destPath -ErrorAction SilentlyContinue).Length
                if ($tam -and $tam -ne $ultimo) {
                    $mb = "{0:N1} MB" -f ($tam / 1MB)
                    Write-Host "`r  $descripcion : $mb  " -NoNewline -ForegroundColor Gray
                    $ultimo = $tam
                }
            }
        }
        Write-Host ""   # salto de linea al terminar

        if ($global:_dlError) { throw $global:_dlError }

        $tamFinal = (Get-Item $destPath).Length
        if ($tamFinal -lt $minBytes) {
            Remove-Item $destPath -Force
            throw "Drive devolvio una respuesta inesperadamente chica ($tamFinal bytes). Verifica que el archivo este compartido como publico."
        }
    } finally {
        Unregister-Event -SourceIdentifier "_BsDlDone" -ErrorAction SilentlyContinue
        $wc.Dispose()
        Remove-Variable _dlDone, _dlError -Scope Global -ErrorAction SilentlyContinue
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

Write-Host "Que queres hacer?" -ForegroundColor White
Write-Host ""

$opciones = @()
foreach ($letra in @('H','C','D','E')) {
    if (Test-Path "${letra}:\") {
        $tag = if ($letra -eq 'H') { "  <- Google Drive (recomendado)" } else { "" }
        $opciones += [pscustomobject]@{ Ruta = "${letra}:\biosoft"; Tag = $tag; SoloMusica = $false }
    }
}
$opciones += [pscustomobject]@{ Ruta = 'Ruta personalizada'; Tag = ''; SoloMusica = $false }
$opciones += [pscustomobject]@{ Ruta = 'Ya esta instalado -- solo configurar la carpeta de musica'; Tag = ''; SoloMusica = $true }

Write-Host "  --- Instalar / actualizar Biosoft en: ---" -ForegroundColor DarkCyan
$iSoloMusica = $opciones.Count - 1
for ($i = 0; $i -lt $iSoloMusica; $i++) {
    Write-Host ("  [{0}] {1}{2}" -f ($i+1), $opciones[$i].Ruta, $opciones[$i].Tag)
}
Write-Host ""
Write-Host ("  [{0}] {1}" -f ($iSoloMusica+1), $opciones[$iSoloMusica].Ruta) -ForegroundColor Yellow
Write-Host ""

do {
    $sel = Read-Host "Elegi una opcion (1-$($opciones.Count))"
    $selNum = $sel -as [int]
} while ($selNum -lt 1 -or $selNum -gt $opciones.Count)

$soloMusica = $opciones[$selNum - 1].SoloMusica

if ($soloMusica) {
    Write-Host ""
    Write-Host "Donde esta instalado Biosoft?" -ForegroundColor White
    Write-Host "  (la carpeta que contiene biosoft.html)" -ForegroundColor Gray
    Write-Host ""
    # Detectar instalaciones existentes
    $encontradas = @()
    foreach ($letra in @('H','C','D','E')) {
        if (Test-Path "${letra}:\biosoft\biosoft.html") { $encontradas += "${letra}:\biosoft" }
    }
    if ($encontradas.Count -gt 0) {
        for ($i = 0; $i -lt $encontradas.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i+1), $encontradas[$i])
        }
        Write-Host ("  [{0}] Otra ruta" -f ($encontradas.Count+1))
        Write-Host ""
        do {
            $selInst = Read-Host "Elegi una opcion (1-$($encontradas.Count+1))"
            $selInstNum = $selInst -as [int]
        } while ($selInstNum -lt 1 -or $selInstNum -gt ($encontradas.Count+1))
        if ($selInstNum -le $encontradas.Count) {
            $destino = $encontradas[$selInstNum - 1]
        } else {
            $destino = (Read-Host "Ingresa la ruta completa").TrimEnd('\')
        }
    } else {
        $destino = (Read-Host "Ingresa la ruta completa").TrimEnd('\')
    }
} elseif ($opciones[$selNum - 1].Ruta -eq 'Ruta personalizada') {
    $destino = (Read-Host "Ingresa la ruta completa").TrimEnd('\')
} else {
    $destino = $opciones[$selNum - 1].Ruta
}

Write-Host ""
$htmlDestino = "$destino\biosoft.html"

if ($soloMusica) {
    # Verificar que existe una instalacion valida
    if (-not (Test-Path $htmlDestino)) {
        Write-Host "  [ERROR] No se encontro biosoft.html en $destino" -ForegroundColor Red
        Write-Host "  Verifica la ruta o instala Biosoft primero." -ForegroundColor Yellow
        Read-Host "Presiona Enter para salir"
        exit 1
    }
    Write-Host "  Instalacion encontrada en $destino" -ForegroundColor Green
    Write-Host ""
} else {

# --- 5. Detectar reinstalacion -----------------------------------

if (Test-Path $htmlDestino) {
    Write-Host "Ya existe una instalacion en $destino" -ForegroundColor Yellow
    $resp = Read-Host "Actualizar? (S/N)"
    if ($resp -notmatch '^[sS]') {
        Write-Host "Cancelado." -ForegroundColor Gray
        Read-Host "Presiona Enter para salir"
        exit 0
    }
}

# --- 6. Crear carpeta de instalacion -----------------------------

Write-Host "Creando carpeta $destino ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $destino -Force | Out-Null
# La subcarpeta musica se crea o enlaza en el paso 8 segun la opcion elegida

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

}   # fin bloque "instalar/actualizar" (no soloMusica)

# --- 7b. Descargar archivos adicionales --------------------------
# Siempre se actualiza (tanto en instalacion nueva como en soloMusica).
# minBytes bajo porque son archivos pequenos (el .ps1 pesa pocos KB).

$ARCHIVOS_EXTRA = @(
    [pscustomobject]@{ Id="1TJu7qEn9omd9nUfpejZWarRCN3NBCoOd"; Nombre="EquivalenciasDeNombres.xlsx"; Desc="EquivalenciasDeNombres.xlsx" }
    [pscustomobject]@{ Id="1XWcsv7t75-BUo-gIVRyjRB3ujGGkktjD"; Nombre="exportar-playlists-winamp.ps1"; Desc="exportar-playlists-winamp.ps1" }
)

Write-Host "Descargando archivos adicionales ..." -ForegroundColor Cyan
foreach ($extra in $ARCHIVOS_EXTRA) {
    $destExtra = "$destino\$($extra.Nombre)"
    try {
        Invoke-DriveDownload $extra.Id $destExtra $extra.Desc 1000
        Write-Host "  [OK] $($extra.Nombre)" -ForegroundColor Green
    } catch {
        Write-Host "  [!] No se pudo descargar $($extra.Nombre): $_" -ForegroundColor Yellow
    }
}

# --- 8. Configurar musica ----------------------------------------

Write-Host ""
Write-Host "-----------------------------------------" -ForegroundColor DarkCyan
Write-Host "  Musica para Biosoft" -ForegroundColor White
Write-Host "-----------------------------------------" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Biosoft necesita acceder a los archivos de musica de Biodanza." -ForegroundColor White
Write-Host "Tenes tres opciones:" -ForegroundColor White
Write-Host ""
Write-Host "  [1] Descargar colecciones desde Internet" -ForegroundColor White
Write-Host "      (mas simple, recomendado si no tenes organizada la musica de Biodanza en esta PC)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [2] Ya tengo una carpeta con musica de Biodanza en esta PC" -ForegroundColor White
Write-Host "      No se copia nada -- Biosoft la va a leer desde donde esta." -ForegroundColor Gray
Write-Host ""
Write-Host "  [3] Configurar la musica despues" -ForegroundColor White
Write-Host "      Biosoft queda instalado pero sin musica." -ForegroundColor Gray
Write-Host ""

do {
    $selMusica = Read-Host "Elegi una opcion (1-3)"
    $selMusicaNum = $selMusica -as [int]
} while ($selMusicaNum -lt 1 -or $selMusicaNum -gt 3)

$resumenMusica = ""
$musicaConfigurada = $false

# Opcion 1: descargar colecciones
if ($selMusicaNum -eq 1) {
    New-Item -ItemType Directory -Path "$destino\musica" -Force | Out-Null

    $infos = @($COLECCIONES | Where-Object { $_.Id -ne "PENDIENTE" })

    Write-Host ""
    Write-Host "Colecciones disponibles:" -ForegroundColor White
    Write-Host ""
    for ($i = 0; $i -lt $infos.Count; $i++) {
        $info  = $infos[$i]
        $bytes = [long]($info.GBytes * 1GB)
        $tam   = "{0:N2} GB" -f $info.GBytes
        $dur   = "~$(Format-Duracion ([math]::Max(1,[math]::Ceiling($bytes / $VELOCIDAD_BYTES_SEG))))"
        Write-Host ("  [{0}] {1,-10} - {2,8}  ({3})" -f ($i+1), $info.Nombre, $tam, $dur)
    }
    Write-Host ""
    Write-Host "  Ingresa los numeros separados por coma (ej: 1,3) o Enter para ninguna." -ForegroundColor Gray
    $selCol = Read-Host "Colecciones a instalar"

    $colDescargadas = @()
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
                Expand-Zip $tmpZip "$destino\musica\$($info.Nombre)"
                Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
                Write-Host "  [OK] $($info.Nombre) instalada." -ForegroundColor Green
                $colDescargadas += $info.Nombre
            } catch {
                Write-Host "  [ERROR] instalando $($info.Nombre): $_" -ForegroundColor Red
                Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
            }
        }
    }
    $musicaConfigurada = $true
    if ($colDescargadas.Count -gt 0) {
        $resumenMusica = "Musica descargada: $($colDescargadas -join ', ') en $destino\musica\"
    } else {
        $resumenMusica = "Musica: ninguna coleccion descargada (carpeta $destino\musica\ creada)"
    }
}

# Opcion 2: carpeta existente
elseif ($selMusicaNum -eq 2) {
    Write-Host ""
    Write-Host "Selecciona cualquier carpeta de tu musica de Biodanza." -ForegroundColor Gray
    Write-Host "(podes elegir una coleccion, un CD o la carpeta raiz -- se detecta automaticamente)" -ForegroundColor Gray

    $junctionOk = $false
    $carpetaMusica = $null

    while (-not $junctionOk) {
        Write-Host ""
        $seleccionada = Select-Carpeta "Selecciona cualquier carpeta de musica de Biodanza"
        if (-not $seleccionada) {
            Write-Host "  Seleccion cancelada." -ForegroundColor Yellow
            $resumenMusica = "Musica: pendiente -- no se configuro"
            break
        }

        Write-Host "  Detectando carpeta raiz ..." -ForegroundColor Gray
        $raizDetectada = Find-MusicaRoot $seleccionada
        $carpetaMusica = if ($raizDetectada) { $raizDetectada } else { $seleccionada }
        Write-Host "  Carpeta raiz: $carpetaMusica" -ForegroundColor Cyan

        $resumen = Get-ResumenMusica $carpetaMusica

        if ($resumen.Count -eq 0) {
            Write-Host "  [!] No se encontraron colecciones de audio en $carpetaMusica" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  [R] Elegir otra carpeta"
            Write-Host "  [C] Continuar igual con esta carpeta"
            Write-Host "  [S] Saltar (configurar la musica despues)"
            $resp = Read-Host "  Opcion"
            if ($resp -match '^[rR]') { continue }
            elseif ($resp -match '^[cC]') { $junctionOk = $true }
            else {
                $resumenMusica = "Musica: pendiente -- no se configuro"
                break
            }
        } else {
            Write-Host ""
            Write-Host "  Colecciones encontradas:" -ForegroundColor White
            $totalArchivos = 0
            foreach ($nombre in ($resumen.Keys | Sort-Object)) {
                Write-Host ("    {0,-15} {1} archivos de audio" -f $nombre, $resumen[$nombre]) -ForegroundColor White
                $totalArchivos += $resumen[$nombre]
            }
            Write-Host "    ---------------"
            Write-Host "    Total: $totalArchivos archivos de audio"
            Write-Host ""
            $confirmar = Read-Host "  Usar esta carpeta? (S=Si, N=Elegir otra)"
            if ($confirmar -match '^[sS]') { $junctionOk = $true }
            # else: loop again
        }
    }

    if ($junctionOk -and $carpetaMusica) {
        Write-Host "  Creando enlace musica -> $carpetaMusica ..." -ForegroundColor Cyan
        try {
            New-Junction "$destino\musica" $carpetaMusica
            Write-Host "  [OK] Enlace creado." -ForegroundColor Green
            Write-Host "       Los archivos NO se copiaron -- Biosoft los lee desde:" -ForegroundColor Gray
            Write-Host "       $carpetaMusica" -ForegroundColor Gray
            $resumenMusica = "Musica enlazada desde: $carpetaMusica"
            $musicaConfigurada = $true
        } catch {
            Write-Host "  [ERROR] No se pudo crear el enlace: $_" -ForegroundColor Red
            $resumenMusica = "Musica: pendiente -- no se pudo crear el enlace"
        }
    }
}

# Opcion 3: despues
else {
    Write-Host ""
    Write-Host "  [!] Biosoft queda instalado pero sin musica." -ForegroundColor Yellow
    Write-Host "      Para configurarla mas adelante:" -ForegroundColor Gray
    Write-Host "      - Abri Biosoft y usa 'Cargar Coleccion Musica'" -ForegroundColor Gray
    Write-Host "      - O volvé a correr este instalador." -ForegroundColor Gray
    $resumenMusica = "Musica: pendiente -- configura desde 'Cargar Coleccion Musica' en la app"
}

# --- 8b. Inyectar config de musica en biosoft.html ---------------

if ($musicaConfigurada) {
    try {
        $installPath = $destino.Replace('\', '\\')
        $tag = "`n<script>window.__BIOSOFT_MUSICA_ROOT__='musica/';window.__BIOSOFT_INSTALL_PATH__='$installPath\\';</script>"
        $enc = New-Object System.Text.UTF8Encoding $false   # UTF-8 sin BOM
        [System.IO.File]::AppendAllText($htmlDestino, $tag, $enc)
    } catch {
        Write-Host "  [!] No se pudo guardar la configuracion de musica: $_" -ForegroundColor Yellow
    }
}

# --- 9. Acceso directo en el escritorio -------------------------

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

# --- 10. Resumen -------------------------------------------------

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
if ($soloMusica) {
    Write-Host "  Configuracion de musica completada." -ForegroundColor Green
} else {
    Write-Host "  Instalacion completada." -ForegroundColor Green
    Write-Host "  Biosoft instalado en: $destino" -ForegroundColor White
}
Write-Host "  $resumenMusica" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$respAbrir = Read-Host "Abrir Biosoft ahora? (S/N)"
if ($respAbrir -match '^[sS]') {
    Start-Process $htmlDestino
}

Read-Host "Presiona Enter para salir"
