<#
  INICIADOR LOCAL DE RUTA

  Ubicación:
    RUTA-CONALTURA\iniciar-ruta.ps1

  Ejecución desde PowerShell o la terminal de PyCharm:
    powershell -ExecutionPolicy Bypass -File .\iniciar-ruta.ps1

  Este archivo:
    1. Comprueba los archivos esenciales.
    2. Busca un puerto disponible desde el 8000.
    3. Inicia un servidor HTTP local con Python.
    4. Abre RUTA en el navegador.

  No modifica Firebase, Git ni los archivos del proyecto.
#>

param(
    [int]$PuertoInicial = 8000,
    [switch]$NoAbrirNavegador
)

$ErrorActionPreference = "Stop"
$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path

function Escribir-Titulo([string]$Texto) {
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host $Texto -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Comprobar-Archivo([string]$RutaRelativa) {
    $RutaCompleta = Join-Path $Raiz $RutaRelativa
    if (-not (Test-Path -LiteralPath $RutaCompleta -PathType Leaf)) {
        throw "Falta el archivo obligatorio: $RutaRelativa"
    }
    Write-Host "[OK] $RutaRelativa" -ForegroundColor Green
}

function Obtener-Python {
    $Candidatos = @(
        @{ Comando = "python"; Argumentos = @() },
        @{ Comando = "py"; Argumentos = @("-3") },
        @{ Comando = "python3"; Argumentos = @() }
    )

    foreach ($Candidato in $Candidatos) {
        $Encontrado = Get-Command $Candidato.Comando -ErrorAction SilentlyContinue
        if ($null -ne $Encontrado) {
            return $Candidato
        }
    }

    throw "No se encontró Python. Instala Python 3 o configura el intérprete de PyCharm."
}

function Puerto-Esta-Libre([int]$Puerto) {
    try {
        $Listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $Puerto
        )
        $Listener.Start()
        $Listener.Stop()
        return $true
    } catch {
        return $false
    }
}

function Obtener-Puerto-Libre([int]$Desde) {
    for ($Puerto = $Desde; $Puerto -le ($Desde + 30); $Puerto++) {
        if (Puerto-Esta-Libre $Puerto) {
            return $Puerto
        }
    }

    throw "No se encontró un puerto libre entre $Desde y $($Desde + 30)."
}

Escribir-Titulo "INICIAR RUTA EN SERVIDOR LOCAL"
Write-Host "Carpeta del proyecto: $Raiz" -ForegroundColor Gray

Write-Host "`n1. Verificando archivos esenciales" -ForegroundColor Cyan
$ArchivosEsenciales = @(
    "index.html",
    "css\estilos.css",
    "css\activos-adquisiciones.css",
    "js\app.js",
    "js\datos.js",
    "js\activos-adquisiciones.js",
    "js\firebase-config.js",
    "js\utilidades.js"
)

try {
    foreach ($Archivo in $ArchivosEsenciales) {
        Comprobar-Archivo $Archivo
    }
} catch {
    Write-Host "`n[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "No se inició el servidor." -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Buscando Python" -ForegroundColor Cyan
try {
    $Python = Obtener-Python
    $Version = & $Python.Comando @($Python.Argumentos) --version 2>&1
    Write-Host "[OK] $Version" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Buscando un puerto disponible" -ForegroundColor Cyan
try {
    $Puerto = Obtener-Puerto-Libre $PuertoInicial
    Write-Host "[OK] Puerto $Puerto disponible" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$Url = "http://localhost:$Puerto/"
$ArgumentosServidor = @($Python.Argumentos) + @(
    "-m",
    "http.server",
    $Puerto,
    "--bind",
    "127.0.0.1",
    "--directory",
    $Raiz
)

Write-Host "`n4. Iniciando servidor" -ForegroundColor Cyan
Write-Host "Dirección: $Url" -ForegroundColor White
Write-Host "Para detener el servidor, cierra la ventana que se abrirá." -ForegroundColor Yellow

try {
    $Proceso = Start-Process `
        -FilePath $Python.Comando `
        -ArgumentList $ArgumentosServidor `
        -WorkingDirectory $Raiz `
        -PassThru

    Start-Sleep -Seconds 2

    if ($Proceso.HasExited) {
        throw "El servidor terminó inmediatamente. Revisa la instalación de Python."
    }

    Write-Host "[OK] Servidor iniciado con PID $($Proceso.Id)" -ForegroundColor Green

    if (-not $NoAbrirNavegador) {
        Start-Process $Url
        Write-Host "[OK] RUTA se abrió en el navegador" -ForegroundColor Green
    } else {
        Write-Host "Navegador no abierto por el parámetro -NoAbrirNavegador." -ForegroundColor Gray
    }

    Write-Host "`nServidor activo en: $Url" -ForegroundColor Cyan
    Write-Host "Prueba primero el ingreso con el usuario compras." -ForegroundColor Cyan
} catch {
    Write-Host "`n[ERROR] No fue posible iniciar RUTA: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
