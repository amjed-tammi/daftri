# إعدادات مشتركة بين ملف التشغيل وملف التثبيت
function Get-DaftariLaunch([string]$Query = '') {
  $root = Split-Path -Parent $PSScriptRoot
  $app = Join-Path $root 'app\index.html'
  if (-not (Test-Path $app)) { throw "لم أجد ملف التطبيق: $app" }
  $uri = ([System.Uri]$app).AbsoluteUri + $Query

  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  $browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

  # ملف تعريف خاص بالتطبيق: كتبك محفوظة هنا ومعزولة عن متصفحك العادي
  $data = Join-Path $env:LOCALAPPDATA 'Daftari'
  $prof = Join-Path $data 'Profile'
  New-Item -ItemType Directory -Force -Path $prof | Out-Null

  $arguments = "--app=`"$uri`" --user-data-dir=`"$prof`" --no-first-run --no-default-browser-check --start-maximized --disable-sync --disable-features=Translate,msEdgeSidebarV2"
  return [pscustomobject]@{ Root = $root; App = $app; Browser = $browser; Arguments = $arguments; Data = $data }
}

function Show-DaftariMessage([string]$text, [string]$icon = 'Information') {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($text, 'دفتري', 'OK', $icon) | Out-Null
}
