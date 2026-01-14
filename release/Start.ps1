param(
  [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$prefix = "http://localhost:$Port/"

Write-Host "ZERTZ release server"
Write-Host "Serving: $root"
Write-Host "URL: $prefix"
Write-Host "Press Ctrl+C to stop."

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

function Get-ContentType([string]$path) {
  switch -regex ($path) {
    '\.html$' { 'text/html; charset=utf-8' }
    '\.js$'   { 'text/javascript; charset=utf-8' }
    '\.css$'  { 'text/css; charset=utf-8' }
    '\.json$' { 'application/json; charset=utf-8' }
    '\.svg$'  { 'image/svg+xml' }
    '\.png$'  { 'image/png' }
    '\.jpg$'  { 'image/jpeg' }
    '\.jpeg$' { 'image/jpeg' }
    '\.gif$'  { 'image/gif' }
    '\.ico$'  { 'image/x-icon' }
    '\.woff2$'{ 'font/woff2' }
    '\.woff$' { 'font/woff' }
    default   { 'application/octet-stream' }
  }
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }

    $filePath = Join-Path $root $relative

    if (!(Test-Path $filePath -PathType Leaf)) {
      # SPA fallback
      $filePath = Join-Path $root 'index.html'
    }

    try {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentType = Get-ContentType $filePath
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $response.StatusCode = 500
      $msg = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
      $response.OutputStream.Write($msg, 0, $msg.Length)
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  if ($listener) { $listener.Stop(); $listener.Close() }
}
