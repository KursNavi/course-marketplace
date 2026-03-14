param(
  [switch]$Redeploy
)

$ErrorActionPreference = 'Stop'

function Set-VercelEnvVar {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][ValidateSet('production', 'preview', 'development')][string]$Environment
  )

  $normalizedValue = $Value.Trim("`r", "`n")

  if ([string]::IsNullOrWhiteSpace($normalizedValue) -or $normalizedValue -like 'PASTE_*') {
    Write-Warning "Skipping $Name for $Environment because the placeholder was not replaced."
    return
  }

  $tmpFile = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmpFile, $normalizedValue, [System.Text.UTF8Encoding]::new($false))
    Get-Content -Path $tmpFile -Raw | npx vercel env add $Name $Environment
  }
  finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Setting Vercel project environment variables for course-marketplace..." -ForegroundColor Cyan

# Replace every placeholder below with the real secret before running.
$envValues = @{
  VITE_SUPABASE_URL = 'PASTE_VITE_SUPABASE_URL_HERE'
  VITE_SUPABASE_KEY = 'PASTE_VITE_SUPABASE_KEY_HERE'
  VITE_SITE_URL = 'https://kursnavi.ch'
  SITE_URL = 'https://kursnavi.ch'
  LEAD_HASH_SALT = 'PASTE_LEAD_HASH_SALT_HERE'
  SUPPORT_EMAIL = 'PASTE_SUPPORT_EMAIL_HERE'
  ADMIN_EMAIL = 'PASTE_ADMIN_EMAIL_HERE'
  EMAIL_FROM = 'PASTE_EMAIL_FROM_HERE'
  RESEND_API_KEY = 'PASTE_RESEND_API_KEY_HERE'
  BREVO_API_KEY = 'PASTE_BREVO_API_KEY_HERE'
  ADMIN_CONSOLE_SECRET = 'PASTE_ADMIN_CONSOLE_SECRET_HERE'
  SUPABASE_URL = 'PASTE_SUPABASE_URL_HERE'
  SUPABASE_SERVICE_ROLE_KEY = 'PASTE_SUPABASE_SERVICE_ROLE_KEY_HERE'
  STRIPE_SECRET_KEY = 'PASTE_STRIPE_SECRET_KEY_HERE'
  STRIPE_WEBHOOK_SECRET = 'PASTE_STRIPE_WEBHOOK_SECRET_HERE'
  STRIPE_TIMEOUT_MS = '30000'
  STRIPE_MAX_NETWORK_RETRIES = '1'
}

$targetEnvironments = @('production', 'preview', 'development')

foreach ($name in $envValues.Keys) {
  foreach ($environment in $targetEnvironments) {
    Set-VercelEnvVar -Name $name -Value $envValues[$name] -Environment $environment
  }
}

Write-Host "Done setting environment variables." -ForegroundColor Green

if ($Redeploy) {
  Write-Host "Triggering production redeploy..." -ForegroundColor Cyan
  npx vercel --prod --yes
}
