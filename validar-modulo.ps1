<#
  VALIDADOR LOCAL DEL MÓDULO ADMINISTRACIÓN DE ACTIVOS Y ADQUISICIONES

  Uso desde la raíz de RUTA-CONALTURA:
    powershell -ExecutionPolicy Bypass -File .\validar-modulo.ps1

  Este script NO modifica archivos, Firebase ni Git.
  Solo verifica estructura, referencias, imports y piezas obligatorias.
#>

$ErrorActionPreference = "Stop"
$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$Errores = New-Object System.Collections.Generic.List[string]
$Avisos = New-Object System.Collections.Generic.List[string]
$Correctos = New-Object System.Collections.Generic.List[string]

function Ruta-Proyecto([string]$Relativa) {
    return Join-Path $Raiz $Relativa
}

function Registrar-Correcto([string]$Mensaje) {
    $Correctos.Add($Mensaje)
    Write-Host "[OK] $Mensaje" -ForegroundColor Green
}

function Registrar-Aviso([string]$Mensaje) {
    $Avisos.Add($Mensaje)
    Write-Host "[AVISO] $Mensaje" -ForegroundColor Yellow
}

function Registrar-Error([string]$Mensaje) {
    $Errores.Add($Mensaje)
    Write-Host "[ERROR] $Mensaje" -ForegroundColor Red
}

function Comprobar-Archivo([string]$Relativa) {
    $Ruta = Ruta-Proyecto $Relativa
    if (Test-Path -LiteralPath $Ruta -PathType Leaf) {
        Registrar-Correcto "Existe $Relativa"
        return $true
    }

    Registrar-Error "Falta $Relativa"
    return $false
}

function Leer-Archivo([string]$Relativa) {
    $Ruta = Ruta-Proyecto $Relativa
    if (-not (Test-Path -LiteralPath $Ruta -PathType Leaf)) {
        return ""
    }
    return Get-Content -LiteralPath $Ruta -Raw -Encoding UTF8
}

function Comprobar-Texto(
    [string]$Relativa,
    [string]$Patron,
    [string]$Descripcion
) {
    $Contenido = Leer-Archivo $Relativa
    if ([string]::IsNullOrWhiteSpace($Contenido)) {
        return
    }

    if ($Contenido -match $Patron) {
        Registrar-Correcto $Descripcion
    } else {
        Registrar-Error "$Descripcion. No se encontró en $Relativa"
    }
}

function Obtener-ImportsLocales([string]$Relativa) {
    $Contenido = Leer-Archivo $Relativa
    if ([string]::IsNullOrWhiteSpace($Contenido)) {
        return @()
    }

    $Coincidencias = [regex]::Matches(
        $Contenido,
        '(?m)from\s+["''](\./[^"'']+)["'']'
    )

    $Resultados = @()
    foreach ($Coincidencia in $Coincidencias) {
        $Resultados += $Coincidencia.Groups[1].Value
    }
    return $Resultados | Sort-Object -Unique
}

function Comprobar-ImportsLocales([string]$Relativa) {
    $RutaOrigen = Ruta-Proyecto $Relativa
    if (-not (Test-Path -LiteralPath $RutaOrigen -PathType Leaf)) {
        return
    }

    $CarpetaOrigen = Split-Path -Parent $RutaOrigen
    foreach ($Import in Obtener-ImportsLocales $Relativa) {
        $Destino = Join-Path $CarpetaOrigen $Import
        $DestinoNormalizado = [System.IO.Path]::GetFullPath($Destino)
        if (Test-Path -LiteralPath $DestinoNormalizado -PathType Leaf) {
            Registrar-Correcto "$Relativa resuelve el import $Import"
        } else {
            Registrar-Error "$Relativa importa $Import, pero el archivo no existe"
        }
    }
}

function Comprobar-Exportacion(
    [string]$Relativa,
    [string]$Nombre
) {
    $Contenido = Leer-Archivo $Relativa
    if ([string]::IsNullOrWhiteSpace($Contenido)) {
        return
    }

    $NombreEscapado = [regex]::Escape($Nombre)
    $Patron = "export\s+(async\s+)?(function|const|let|var|class)\s+$NombreEscapado\b"
    if ($Contenido -match $Patron) {
        Registrar-Correcto "$Relativa exporta $Nombre"
    } else {
        Registrar-Error "$Relativa no exporta $Nombre"
    }
}

function Comprobar-Node {
    $Node = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $Node) {
        Registrar-Aviso "Node.js no está instalado; se omite la revisión sintáctica automática de JavaScript"
        return
    }

    $ArchivosJs = @(
        "js\activos-adquisiciones.js",
        "js\app.js",
        "js\datos.js"
    )

    foreach ($Relativa in $ArchivosJs) {
        $Ruta = Ruta-Proyecto $Relativa
        if (-not (Test-Path -LiteralPath $Ruta -PathType Leaf)) {
            continue
        }

        & node --check $Ruta 2>$null
        if ($LASTEXITCODE -eq 0) {
            Registrar-Correcto "Sintaxis JavaScript válida en $Relativa"
        } else {
            Registrar-Error "Node.js encontró un error de sintaxis en $Relativa"
        }
    }
}

function Comprobar-Conflictos-Git {
    $Git = Get-Command git -ErrorAction SilentlyContinue
    if ($null -eq $Git) {
        Registrar-Aviso "Git no está disponible en esta terminal"
        return
    }

    Push-Location $Raiz
    try {
        & git rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -ne 0) {
            Registrar-Aviso "La carpeta no parece ser un repositorio Git"
            return
        }

        $Conflictos = & git diff --name-only --diff-filter=U
        if ([string]::IsNullOrWhiteSpace(($Conflictos -join ""))) {
            Registrar-Correcto "No hay conflictos de Git sin resolver"
        } else {
            Registrar-Error "Hay conflictos de Git sin resolver: $($Conflictos -join ', ')"
        }

        $Estado = & git status --short
        if ($Estado) {
            Write-Host "`nArchivos modificados detectados por Git:" -ForegroundColor Cyan
            $Estado | ForEach-Object { Write-Host "  $_" }
        } else {
            Registrar-Aviso "Git no detecta cambios locales"
        }
    } finally {
        Pop-Location
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "VALIDACIÓN DEL MÓDULO ADMINISTRACIÓN DE ACTIVOS" -ForegroundColor Cyan
Write-Host "Raíz: $Raiz" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# 1. Estructura requerida
$ArchivosRequeridos = @(
    "index.html",
    "firestore.rules",
    "css\estilos.css",
    "css\activos-adquisiciones.css",
    "js\app.js",
    "js\datos.js",
    "js\activos-adquisiciones.js",
    "js\firebase-config.js",
    "js\utilidades.js",
    "js\inventario.js",
    "js\compras.js",
    "js\traslados.js",
    "js\aprobaciones.js",
    "js\mis-elementos.js",
    "js\reportes.js"
)

Write-Host "1. Verificando archivos" -ForegroundColor Cyan
foreach ($Archivo in $ArchivosRequeridos) {
    [void](Comprobar-Archivo $Archivo)
}

# 2. Integración del HTML
Write-Host "`n2. Verificando index.html" -ForegroundColor Cyan
Comprobar-Texto "index.html" 'href=["'']css/estilos[.]css["'']' "index.html carga estilos.css"
Comprobar-Texto "index.html" 'href=["'']css/activos-adquisiciones[.]css["'']' "index.html carga activos-adquisiciones.css"
Comprobar-Texto "index.html" 'type=["'']module["'']\s+src=["'']js/app[.]js["'']' "index.html carga app.js como módulo"
Comprobar-Texto "index.html" 'id=["'']contenido["'']' "index.html conserva el contenedor contenido"
Comprobar-Texto "index.html" 'id=["'']menu["'']' "index.html conserva el contenedor menu"

# 3. Integración de app.js
Write-Host "`n3. Verificando app.js" -ForegroundColor Cyan
Comprobar-Texto "js\app.js" 'from\s+["''][.]\/activos-adquisiciones[.]js["'']' "app.js importa activos-adquisiciones.js"
Comprobar-Texto "js\app.js" 'Administración de Activos y Adquisiciones' "app.js incluye el nombre visible del rol"
Comprobar-Texto "js\app.js" 'Registrar adquisición' "app.js incluye Registrar adquisición"
Comprobar-Texto "js\app.js" 'Gestionar activos' "app.js incluye Gestionar activos"
Comprobar-Texto "js\app.js" 'Gestionar saldos y bajas' "app.js incluye Gestionar saldos y bajas"
Comprobar-Texto "js\app.js" 'Valoración de activos' "app.js incluye Valoración de activos"

# 4. Exportaciones de datos.js
Write-Host "`n4. Verificando datos.js" -ForegroundColor Cyan
Comprobar-Texto "js\datos.js" 'const\s+MOVIMIENTOS_ACTIVOS\s*=\s*["'']movimientos_activos["'']' "datos.js declara movimientos_activos"
Comprobar-Exportacion "js\datos.js" "leerInventario"
Comprobar-Exportacion "js\datos.js" "guardarElementos"
Comprobar-Exportacion "js\datos.js" "leerMovimientosActivos"
Comprobar-Exportacion "js\datos.js" "registrarMovimientoActivo"
Comprobar-Exportacion "js\datos.js" "mensajeDeError"

# 5. Exportaciones del módulo
Write-Host "`n5. Verificando activos-adquisiciones.js" -ForegroundColor Cyan
Comprobar-Exportacion "js\activos-adquisiciones.js" "mostrarRegistrarAdquisicion"
Comprobar-Exportacion "js\activos-adquisiciones.js" "mostrarGestionarActivos"
Comprobar-Exportacion "js\activos-adquisiciones.js" "mostrarSaldosBajas"
Comprobar-Exportacion "js\activos-adquisiciones.js" "mostrarValoracionActivos"

# 6. Reglas de Firestore
Write-Host "`n6. Verificando firestore.rules" -ForegroundColor Cyan
Comprobar-Texto "firestore.rules" 'match\s+/movimientos_activos/\{id\}' "Las reglas incluyen movimientos_activos"
Comprobar-Texto "firestore.rules" "'ADQUISICIÓN'" "Las reglas permiten ADQUISICIÓN"
Comprobar-Texto "firestore.rules" "'ACTUALIZACIÓN'" "Las reglas permiten ACTUALIZACIÓN"
Comprobar-Texto "firestore.rules" "'SALDO'" "Las reglas permiten SALDO"
Comprobar-Texto "firestore.rules" "'BAJA'" "Las reglas permiten BAJA"
Comprobar-Texto "firestore.rules" 'allow\s+update:\s+if\s+false' "Los movimientos son inmutables"

# 7. Resolución de imports
Write-Host "`n7. Verificando imports locales" -ForegroundColor Cyan
Comprobar-ImportsLocales "js\app.js"
Comprobar-ImportsLocales "js\datos.js"
Comprobar-ImportsLocales "js\activos-adquisiciones.js"

# 8. Sintaxis y Git
Write-Host "`n8. Verificando sintaxis y repositorio" -ForegroundColor Cyan
Comprobar-Node
Comprobar-Conflictos-Git

# Resumen final
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "RESUMEN" -ForegroundColor Cyan
Write-Host "Correctos: $($Correctos.Count)" -ForegroundColor Green
Write-Host "Avisos:    $($Avisos.Count)" -ForegroundColor Yellow
Write-Host "Errores:   $($Errores.Count)" -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Cyan

if ($Avisos.Count -gt 0) {
    Write-Host "`nAvisos:" -ForegroundColor Yellow
    foreach ($Aviso in $Avisos) {
        Write-Host "- $Aviso" -ForegroundColor Yellow
    }
}

if ($Errores.Count -gt 0) {
    Write-Host "`nErrores que deben corregirse:" -ForegroundColor Red
    foreach ($ErrorEncontrado in $Errores) {
        Write-Host "- $ErrorEncontrado" -ForegroundColor Red
    }
    Write-Host "`nVALIDACIÓN FALLIDA" -ForegroundColor Red
    exit 1
}

Write-Host "`nVALIDACIÓN APROBADA" -ForegroundColor Green
Write-Host "La estructura está preparada para iniciar las pruebas funcionales." -ForegroundColor Green
exit 0
