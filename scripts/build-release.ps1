$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed; release was not packaged.' }
    $packageInfo = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
    $releaseDirectory = Join-Path $projectRoot 'releases'
    New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
    $archivePath = Join-Path $releaseDirectory ('Locatr-' + $packageInfo.version + '.zip')
    $sourcePaths = @('package.json', 'package-lock.json', 'server.js', 'public', 'README.md', 'CHANGELOG.md', 'Dockerfile', 'compose.yaml', '.env.example', 'docs', 'deploy', 'scripts', 'test', '.dockerignore', '.gitignore', '.gitattributes')
    Compress-Archive -LiteralPath $sourcePaths -DestinationPath $archivePath -Force
    Write-Output "Built $archivePath"
} finally {
    Pop-Location
}
