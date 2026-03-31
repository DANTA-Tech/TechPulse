param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-MimeType([string]$Path) {
  $ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($ext) {
    ".html" { return "text/html; charset=utf-8" }
    ".css"  { return "text/css; charset=utf-8" }
    ".js"   { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".txt"  { return "text/plain; charset=utf-8" }
    ".svg"  { return "image/svg+xml; charset=utf-8" }
    ".png"  { return "image/png" }
    ".jpg"  { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".gif"  { return "image/gif" }
    default  { return "application/octet-stream" }
  }
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host ("Serving: {0}" -f $Root)
Write-Host ("URL: {0}" -f $prefix)
Write-Host "Press Ctrl+C to stop."

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $req = $context.Request
    $resp = $context.Response

    $path = $req.Url.AbsolutePath
    if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") {
      $path = "/index.html"
    }

    # Basic hardening: only allow file name portion.
    $safePath = [IO.Path]::GetFileName($path)
    $fullPath = Join-Path $Root $safePath

    if (!(Test-Path $fullPath)) {
      # For SPA-like routes, fallback to index.
      $fullPath = Join-Path $Root "index.html"
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $resp.ContentType = (Get-MimeType $fullPath)
    $resp.StatusCode = 200
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    $resp.OutputStream.Close()
  } catch {
    try {
      $resp = $context.Response
      $resp.StatusCode = 500
      $resp.OutputStream.Close()
    } catch {}
  }
}

$listener.Stop()

