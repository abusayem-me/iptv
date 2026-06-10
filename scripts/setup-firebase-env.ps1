#Requires -Version 5.1
<#
.SYNOPSIS
  Generates .env.local from your Firebase WEB app (same as npm run env:firebase).

.DESCRIPTION
  Requires Node.js, npm, and `firebase login` (CLI). Uses .firebaserc default project
  or environment variable FIREBASE_PROJECT.

.EXAMPLE
  .\scripts\setup-firebase-env.ps1
  $env:FIREBASE_PROJECT = "other-id"; .\scripts\setup-firebase-env.ps1
#>
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..")
Set-Location $root
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is required."
}
node (Join-Path $here "generate-env-local.mjs")
