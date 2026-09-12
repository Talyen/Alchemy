param([Parameter(Mandatory = $true)][string]$Executable)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$profileDirectory = Join-Path ([IO.Path]::GetTempPath()) ("alchemy-package-smoke-" + [guid]::NewGuid())
$game = New-Object Diagnostics.Process
$game.StartInfo.FileName = (Resolve-Path -LiteralPath $Executable).Path
$game.StartInfo.WorkingDirectory = Split-Path -Parent $game.StartInfo.FileName
$game.StartInfo.UseShellExecute = $false
# Electron applies user-data-dir before the app reads its save paths.
$game.StartInfo.Arguments = '--force-renderer-accessibility --disable-gpu --mute-audio --user-data-dir="{0}"' -f $profileDirectory
$started = $false

try {
    New-Item -ItemType Directory -Path $profileDirectory | Out-Null
    $started = $game.Start()
    if (-not $started) { throw "Could not launch the packaged game." }
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $playCondition = [System.Windows.Automation.AndCondition]::new(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Play"),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
    )
    $ready = $false
    while ($timer.Elapsed.TotalSeconds -lt 60) {
        $game.Refresh()
        if ($game.HasExited) { throw "Packaged game exited before the title screen (exit $($game.ExitCode))." }
        if ($game.MainWindowHandle -ne [IntPtr]::Zero) {
            try {
                $window = [System.Windows.Automation.AutomationElement]::FromHandle($game.MainWindowHandle)
                $play = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $playCondition)
                if ($null -ne $play -and $play.Current.IsEnabled -and -not $play.Current.IsOffscreen) {
                    $ready = $true
                    break
                }
            } catch [System.Windows.Automation.ElementNotAvailableException] {
                # The startup window can be replaced before the renderer is ready.
            }
        }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw "Packaged game did not show an enabled Play button within 60 seconds." }
    Write-Output "Packaged Windows game reached the title screen."
} finally {
    if ($started -and -not $game.HasExited) {
        $null = $game.CloseMainWindow()
        if (-not $game.WaitForExit(5000)) {
            & taskkill.exe /PID $game.Id /T /F | Out-Null
            if (-not $game.WaitForExit(5000)) { throw "Packaged game did not exit after cleanup." }
        }
    }
    $game.Dispose()
    Remove-Item -LiteralPath $profileDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
