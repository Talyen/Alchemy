param(
  [string]$InputPath,
  [string]$OutputDir,
  [int]$AlphaThreshold = 10,
  [int]$MinPixels = 80
)

$ErrorActionPreference = 'Stop'

if (-not $InputPath -or -not $OutputDir) {
  throw 'Usage: ./scripts/extract-ui-sprites.ps1 -InputPath <png> -OutputDir <dir> [-AlphaThreshold 10] [-MinPixels 80]'
}

if (-not (Test-Path $InputPath)) {
  throw "Input image not found: $InputPath"
}

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$bmp = [System.Drawing.Bitmap]::new($InputPath)
try {
  $w = $bmp.Width
  $h = $bmp.Height

  $visited = New-Object 'bool[,]' $w, $h
  $components = @()

  function IsOpaque([System.Drawing.Bitmap]$img, [int]$x, [int]$y, [int]$alphaThreshold) {
    $px = $img.GetPixel($x, $y)
    return $px.A -ge $alphaThreshold
  }

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      if ($visited[$x, $y]) { continue }
      $visited[$x, $y] = $true
      if (-not (IsOpaque $bmp $x $y $AlphaThreshold)) { continue }

      $queue = New-Object 'System.Collections.Generic.Queue[System.Drawing.Point]'
      $pixels = New-Object 'System.Collections.Generic.List[System.Drawing.Point]'
      $queue.Enqueue([System.Drawing.Point]::new($x, $y))

      $minX = $x; $maxX = $x; $minY = $y; $maxY = $y

      while ($queue.Count -gt 0) {
        $p = $queue.Dequeue()
        $pixels.Add($p)

        if ($p.X -lt $minX) { $minX = $p.X }
        if ($p.X -gt $maxX) { $maxX = $p.X }
        if ($p.Y -lt $minY) { $minY = $p.Y }
        if ($p.Y -gt $maxY) { $maxY = $p.Y }

        $neighbors = @(
          [System.Drawing.Point]::new($p.X - 1, $p.Y),
          [System.Drawing.Point]::new($p.X + 1, $p.Y),
          [System.Drawing.Point]::new($p.X, $p.Y - 1),
          [System.Drawing.Point]::new($p.X, $p.Y + 1)
        )

        foreach ($n in $neighbors) {
          if ($n.X -lt 0 -or $n.X -ge $w -or $n.Y -lt 0 -or $n.Y -ge $h) { continue }
          if ($visited[$n.X, $n.Y]) { continue }
          $visited[$n.X, $n.Y] = $true
          if (IsOpaque $bmp $n.X $n.Y $AlphaThreshold) {
            $queue.Enqueue($n)
          }
        }
      }

      if ($pixels.Count -lt $MinPixels) { continue }

      $components += [PSCustomObject]@{
        PixelCount = $pixels.Count
        MinX = $minX
        MinY = $minY
        MaxX = $maxX
        MaxY = $maxY
        Pixels = $pixels
      }
    }
  }

  $components = $components | Sort-Object PixelCount -Descending

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($InputPath)
  $meta = @()

  for ($i = 0; $i -lt $components.Count; $i++) {
    $c = $components[$i]
    $cw = $c.MaxX - $c.MinX + 1
    $ch = $c.MaxY - $c.MinY + 1

    $outBmp = [System.Drawing.Bitmap]::new($cw, $ch)
    try {
      foreach ($p in $c.Pixels) {
        $src = $bmp.GetPixel($p.X, $p.Y)
        $outBmp.SetPixel($p.X - $c.MinX, $p.Y - $c.MinY, $src)
      }

      $name = '{0}_{1:D2}_{2}x{3}.png' -f $baseName, ($i + 1), $cw, $ch
      $outPath = Join-Path $OutputDir $name
      $outBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

      $meta += [PSCustomObject]@{
        File = $name
        PixelCount = $c.PixelCount
        X = $c.MinX
        Y = $c.MinY
        Width = $cw
        Height = $ch
      }
    } finally {
      $outBmp.Dispose()
    }
  }

  $metaPath = Join-Path $OutputDir ($baseName + '_meta.json')
  $meta | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -Path $metaPath

  Write-Output ("Extracted " + $components.Count + " sprites from " + $InputPath)
  Write-Output ("Output: " + $OutputDir)
  Write-Output ("Metadata: " + $metaPath)
} finally {
  $bmp.Dispose()
}
