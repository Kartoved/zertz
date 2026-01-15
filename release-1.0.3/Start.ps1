param(
  [int]$Port = 5050
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$url = "http://localhost:$Port/"

Write-Host "ZERTZ release server"
Write-Host "Serving: $root"
Write-Host "API + UI: $url"
Write-Host "Press Ctrl+C to stop."

$env:PORT = $Port

Start-Process -FilePath "node" -ArgumentList "server/server.js" -WorkingDirectory $root
Start-Sleep -Milliseconds 400
Start-Process $url

Wait-Process -Name node
