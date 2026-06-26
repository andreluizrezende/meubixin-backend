<#
.SYNOPSIS
  Replica o banco de producao localmente e roda as migracoes pendentes.

.DESCRIPTION
  Fluxo:
    1. Le as credenciais de PRODUCAO do arquivo .env (PROD_DB_*).
    2. Faz um mysqldump consistente de producao (sem travar o banco).
    3. (Re)cria o banco local e restaura o dump.
    4. Roda `sequelize-cli db:migrate --env development` contra o banco local.

  As credenciais LOCAIS sao lidas das variaveis DEV_DB_* do .env.
  NUNCA roda migracao em producao — usa sempre --env development.

.EXAMPLE
  ./scripts/sync-prod-to-local.ps1

.EXAMPLE
  ./scripts/sync-prod-to-local.ps1 -SchemaOnly       # so estrutura, sem dados

.EXAMPLE
  ./scripts/sync-prod-to-local.ps1 -SkipDump          # reaproveita o ultimo dump
#>

[CmdletBinding()]
param(
    [string]$EnvFile    = "$PSScriptRoot/../.env",
    [string]$DumpFile   = "$PSScriptRoot/../prod_dump.sql",
    [switch]$SchemaOnly,   # dump so de estrutura (--no-data)
    [switch]$SkipDump,     # nao baixa de novo, usa o $DumpFile existente
    [switch]$SkipMigrate   # so restaura, nao roda migracoes
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv($path) {
    if (-not (Test-Path $path)) { throw "Arquivo .env nao encontrado: $path" }
    $map = @{}
    foreach ($line in Get-Content $path) {
        $t = $line.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $idx = $t.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $t.Substring(0, $idx).Trim()
        $val = $t.Substring($idx + 1).Trim()
        # remove aspas simples ou duplas envolventes
        if ($val.Length -ge 2 -and
            (($val[0] -eq "'" -and $val[-1] -eq "'") -or ($val[0] -eq '"' -and $val[-1] -eq '"'))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $map[$key] = $val
    }
    return $map
}

function Require-Cmd($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "'$name' nao esta no PATH. Instale o MySQL client ou ajuste o PATH."
    }
}

Write-Host "==> Lendo credenciais de $EnvFile" -ForegroundColor Cyan
$env = Read-DotEnv $EnvFile

# --- PRODUCAO (origem) ---
$prodHost = $env['PROD_DB_HOST']; $prodPort = $env['PROD_DB_PORT']
$prodUser = $env['PROD_DB_USER']; $prodPass = $env['PROD_DB_PASS']
$prodName = $env['PROD_DB_NAME']
foreach ($p in 'PROD_DB_HOST','PROD_DB_PORT','PROD_DB_USER','PROD_DB_PASS','PROD_DB_NAME') {
    if ([string]::IsNullOrWhiteSpace($env[$p])) { throw "Variavel $p ausente no .env" }
}

# --- LOCAL (destino) ---
$devHost = if ($env['DEV_DB_HOST']) { $env['DEV_DB_HOST'] } else { '127.0.0.1' }
$devPort = if ($env['DEV_DB_PORT']) { $env['DEV_DB_PORT'] } else { '3306' }
$devUser = if ($env['DEV_DB_USER']) { $env['DEV_DB_USER'] } else { 'root' }
$devPass = $env['DEV_DB_PASS']
$devName = if ($env['DEV_DB_NAME']) { $env['DEV_DB_NAME'] } else { "${prodName}_local" }
if ([string]::IsNullOrWhiteSpace($devName)) { throw "DEV_DB_NAME nao definido e PROD_DB_NAME vazio" }

Require-Cmd 'mysqldump'
Require-Cmd 'mysql'

# ---------------------------------------------------------------------------
# 1) DUMP DE PRODUCAO
# ---------------------------------------------------------------------------
if (-not $SkipDump) {
    Write-Host "==> Dump de PRODUCAO ($prodName @ $prodHost) -> $DumpFile" -ForegroundColor Cyan
    $dumpArgs = @(
        "-h", $prodHost, "-P", $prodPort, "-u", $prodUser,
        "--single-transaction", "--quick", "--no-tablespaces",
        "--set-gtid-purged=OFF",
        "--default-character-set=utf8mb4"
    )
    if ($SchemaOnly) { $dumpArgs += "--no-data" }
    # --result-file: o proprio mysqldump escreve o arquivo, evitando o
    # PowerShell reencodar o stream (BOM/utf8mb4 corrompido no PS 5.1).
    $dumpArgs += "--result-file=$DumpFile"
    $dumpArgs += $prodName

    # senha via env var MYSQL_PWD (nao aparece na lista de processos)
    $env:MYSQL_PWD = $prodPass
    try {
        & mysqldump @dumpArgs
        if ($LASTEXITCODE -ne 0) { throw "mysqldump falhou (exit $LASTEXITCODE)" }
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
    Write-Host "    OK ($([math]::Round((Get-Item $DumpFile).Length/1MB,2)) MB)" -ForegroundColor Green
} else {
    Write-Host "==> Pulando dump, usando $DumpFile" -ForegroundColor Yellow
    if (-not (Test-Path $DumpFile)) { throw "Dump nao existe: $DumpFile" }
}

# ---------------------------------------------------------------------------
# 2) (RE)CRIA E RESTAURA O BANCO LOCAL
# ---------------------------------------------------------------------------
Write-Host "==> Restaurando em LOCAL ($devName @ $devHost)" -ForegroundColor Cyan
$env:MYSQL_PWD = $devPass
try {
    $createSql = "DROP DATABASE IF EXISTS ``$devName``; CREATE DATABASE ``$devName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    & mysql -h $devHost -P $devPort -u $devUser -e $createSql
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar database local (exit $LASTEXITCODE)" }

    # O cliente mysql nao abre caminhos com acento (ex.: pasta 'André') -> error 2.
    # Copiamos o dump para um caminho temporario ASCII e damos 'source' de la.
    $tmpDump = Join-Path $env:TEMP ("prod_dump_{0}.sql" -f (Get-Random))
    Copy-Item -LiteralPath (Resolve-Path $DumpFile).Path -Destination $tmpDump -Force
    try {
        $sourcePath = $tmpDump -replace '\\', '/'
        & mysql -h $devHost -P $devPort -u $devUser $devName -e "source $sourcePath"
        if ($LASTEXITCODE -ne 0) { throw "Falha ao restaurar dump (exit $LASTEXITCODE)" }
    } finally {
        Remove-Item -LiteralPath $tmpDump -Force -ErrorAction SilentlyContinue
    }
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
Write-Host "    Banco local restaurado." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3) MIGRACOES — SEMPRE em development, nunca em producao
# ---------------------------------------------------------------------------
if ($SkipMigrate) {
    Write-Host "==> Pulando migracoes (-SkipMigrate)." -ForegroundColor Yellow
    return
}

# O sequelize-cli NAO carrega o .env (sem .sequelizerc / sem require dotenv no
# config.js). Exportamos DEV_DB_* para o processo para a config 'development'
# resolver a conexao local. PROD_DB_* nao sao exportadas de proposito.
$env:DEV_DB_HOST = $devHost
$env:DEV_DB_PORT = $devPort
$env:DEV_DB_USER = $devUser
$env:DEV_DB_PASS = $devPass
$env:DEV_DB_NAME = $devName

# Chama o binario local direto (npx as vezes nao resolve o executavel).
# Roda a partir da raiz do projeto para achar config/ e migrations/.
$projectRoot = (Resolve-Path "$PSScriptRoot/..").Path
$seqCli = Join-Path $projectRoot "node_modules\.bin\sequelize-cli.cmd"
if (-not (Test-Path $seqCli)) {
    throw "sequelize-cli nao encontrado em $seqCli. Rode 'yarn install' / 'npm install'."
}

Push-Location $projectRoot
try {
    Write-Host "==> Status atual das migracoes (development):" -ForegroundColor Cyan
    & $seqCli db:migrate:status --env development

    Write-Host "==> Rodando migracoes pendentes em LOCAL (development)..." -ForegroundColor Cyan
    & $seqCli db:migrate --env development
    if ($LASTEXITCODE -ne 0) { throw "Migracao falhou (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Concluido. Producao NAO foi alterada - migracoes rodaram so em '$devName'." -ForegroundColor Green
Write-Host "Para aplicar em producao depois de validar:" -ForegroundColor Green
Write-Host "  npx sequelize-cli db:migrate --env production" -ForegroundColor Green
