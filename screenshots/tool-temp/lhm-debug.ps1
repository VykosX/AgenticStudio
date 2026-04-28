$exePath = 'C:\Program Files\LibreHardwareMonitor\LibreHardwareMonitor.exe'
$baseDir = Split-Path -Path $exePath -Parent
$candidates = @(
  (Join-Path $baseDir 'LibreHardwareMonitorLib.dll'),
  (Join-Path $baseDir 'lib\LibreHardwareMonitorLib.dll')
)
$dllPath = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1)
if (-not $dllPath) { throw 'LibreHardwareMonitorLib.dll was not found next to the configured LibreHardwareMonitor executable.' }
[System.Reflection.Assembly]::UnsafeLoadFrom($dllPath) | Out-Null
$computer = New-Object LibreHardwareMonitor.Hardware.Computer
try { $computer.IsCpuEnabled = $true } catch {}
$computer.IsGpuEnabled = $true
try { $computer.IsMemoryEnabled = $true } catch {}
try { $computer.IsMotherboardEnabled = $true } catch {}
try { $computer.IsControllerEnabled = $true } catch {}
try { $computer.IsStorageEnabled = $true } catch {}
try { $computer.IsNetworkEnabled = $true } catch {}
try { $computer.IsBatteryEnabled = $true } catch {}
try { $computer.IsPsuEnabled = $true } catch {}
$computer.Open()
function Get-LhmSensors($hardware) {
  $items = @()
  foreach ($sensor in @($hardware.Sensors)) {
    $items += [pscustomobject]@{
      name = [string]$sensor.Name
      sensorType = [string]$sensor.SensorType
      value = $sensor.Value
      min = $sensor.Min
      max = $sensor.Max
      identifier = [string]$sensor.Identifier
    }
  }
  foreach ($subHardware in @($hardware.SubHardware)) {
    $subHardware.Update()
    $items += @(Get-LhmSensors $subHardware)
  }
  return $items
}
try {
  $items = foreach ($hardware in @($computer.Hardware)) {
    $hardware.Update()
    [pscustomobject]@{
      source = 'librehardwaremonitor'
      identifier = [string]$hardware.Identifier
      hardwareName = [string]$hardware.Name
      hardwareType = [string]$hardware.HardwareType
      sensors = @(Get-LhmSensors $hardware)
    }
  }
  $items | ConvertTo-Json -Compress -Depth 8
} finally {
  $computer.Close()
}
