# يحوّل دفتري إلى تطبيق: أيقونة على سطح المكتب وفي قائمة ابدأ
$ErrorActionPreference = 'Stop'
try {
  . (Join-Path $PSScriptRoot 'common.ps1')
  $L = Get-DaftariLaunch
  if (-not $L.Browser) { throw 'لم أجد متصفح Microsoft Edge أو Google Chrome على الجهاز.' }

  # ===== رسم الأيقونة =====
  Add-Type -AssemblyName System.Drawing
  $S = 256
  $bmp = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 56
  $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
  $path.AddArc($S - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
  $path.AddArc($S - 2 * $r, $S - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $path.AddArc(0, $S - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $path.CloseFigure()
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0, 0)), ([System.Drawing.Point]::new($S, $S)), ([System.Drawing.Color]::FromArgb(11, 26, 58)), ([System.Drawing.Color]::FromArgb(27, 53, 112))
  $g.FillPath($bg, $path)

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
  foreach ($st in @(@(44, 50, 5), @(86, 30, 3), @(208, 96, 4), @(70, 92, 3), @(118, 64, 2))) { $g.FillEllipse($white, $st[0], $st[1], $st[2], $st[2]) }

  # الهلال
  $gold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 199, 122))
  $g.FillEllipse($gold, 148, 26, 70, 70)
  $cut = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 41, 88))
  $g.FillEllipse($cut, 168, 14, 70, 70)

  # الكتاب المفتوح
  $paper = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(251, 244, 225))
  $left = [System.Drawing.Point[]]@([System.Drawing.Point]::new(34, 126), [System.Drawing.Point]::new(126, 138), [System.Drawing.Point]::new(126, 226), [System.Drawing.Point]::new(34, 214))
  $right = [System.Drawing.Point[]]@([System.Drawing.Point]::new(222, 126), [System.Drawing.Point]::new(130, 138), [System.Drawing.Point]::new(130, 226), [System.Drawing.Point]::new(222, 214))
  $g.FillPolygon($paper, $left)
  $g.FillPolygon($paper, $right)
  $line = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 159, 179, 217)), 3
  foreach ($y in @(158, 178, 198)) {
    $g.DrawLine($line, 46, $y - 6, 116, $y + 2)
    $g.DrawLine($line, 140, $y + 2, 210, $y - 6)
  }
  $spine = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(184, 154, 92)), 3
  $g.DrawLine($spine, 128, 138, 128, 226)
  $g.Dispose()

  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $png = $ms.ToArray()
  $bmp.Dispose()

  New-Item -ItemType Directory -Force -Path $L.Data | Out-Null
  $ico = Join-Path $L.Data 'daftari.ico'
  $fs = [System.IO.File]::Create($ico)
  $bw = New-Object System.IO.BinaryWriter $fs
  $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
  $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
  $bw.Write($png)
  $bw.Close()

  # ===== الاختصارات =====
  $ws = New-Object -ComObject WScript.Shell
  $places = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
  foreach ($dir in $places) {
    if (-not $dir) { continue }
    $lnk = $ws.CreateShortcut((Join-Path $dir 'دفتري.lnk'))
    $lnk.TargetPath = $L.Browser
    $lnk.Arguments = $L.Arguments
    $lnk.IconLocation = "$ico,0"
    $lnk.WorkingDirectory = $L.Root
    $lnk.Description = 'دفتري — دفتر الكتابة والدراسة'
    $lnk.Save()
  }

  Show-DaftariMessage "تم! صار «دفتري» تطبيقاً على جهازك.`n`n• أيقونة «دفتري» على سطح المكتب`n• وفي قائمة ابدأ (تقدر تثبّتها على شريط المهام)`n`nملاحظة: لا تنقل مجلد البرنامج بعد التثبيت، وإذا نقلته شغّل ملف التثبيت مرة ثانية."
}
catch {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show("تعذّر التثبيت:`n$($_.Exception.Message)", 'دفتري', 'OK', 'Error') | Out-Null
}
