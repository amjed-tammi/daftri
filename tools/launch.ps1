# يشغّل دفتري كنافذة تطبيق مستقلة (بدون شريط عناوين المتصفح)
$ErrorActionPreference = 'Stop'
try {
  . (Join-Path $PSScriptRoot 'common.ps1')
  $L = Get-DaftariLaunch
  if (-not $L.Browser) { Start-Process $L.App; exit 0 }
  Start-Process -FilePath $L.Browser -ArgumentList $L.Arguments
}
catch {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show("تعذّر تشغيل دفتري:`n$($_.Exception.Message)", 'دفتري', 'OK', 'Error') | Out-Null
}
