# بيفتح ملف كتاب مشارَك (.daftar): بيحطه بصندوق الوارد وبيفتح التطبيق ليستورده
param([string]$File)
$ErrorActionPreference = 'Stop'
try {
  . (Join-Path $PSScriptRoot 'common.ps1')
  if (-not $File -or -not (Test-Path -LiteralPath $File)) { throw 'ما لقيت الملف.' }
  $root = Split-Path -Parent $PSScriptRoot
  $inbox = Join-Path $root 'app\inbox'
  New-Item -ItemType Directory -Force -Path $inbox | Out-Null
  $bytes = [IO.File]::ReadAllBytes($File)
  $b64 = [Convert]::ToBase64String($bytes)
  $name = [IO.Path]::GetFileNameWithoutExtension($File).Replace('\', '\\').Replace('"', '\"')
  $js = "window.DAFTARI_INBOX = [{ name: `"$name`", b64: `"$b64`" }];"
  [IO.File]::WriteAllText((Join-Path $inbox 'pending.js'), $js, (New-Object System.Text.UTF8Encoding $false))
  $L = Get-DaftariLaunch ("?inbox=" + [DateTime]::Now.Ticks)
  if (-not $L.Browser) { throw 'لم أجد متصفح Microsoft Edge أو Google Chrome على الجهاز.' }
  Start-Process -FilePath $L.Browser -ArgumentList $L.Arguments
}
catch {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show("تعذّر فتح الكتاب:`n$($_.Exception.Message)", 'دفتري', 'OK', 'Error') | Out-Null
}
