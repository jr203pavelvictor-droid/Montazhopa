$ErrorActionPreference = 'Stop'
$bundle = 'com.victor.motionviewer'
$source = Join-Path $PSScriptRoot $bundle
$base = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$target = Join-Path $base $bundle
$stage = Join-Path $base ($bundle + '.install-staging')
$backup = Join-Path $base ($bundle + '.previous')
if (Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -like '*Premiere*'}) {
    throw 'Close Adobe Premiere Pro completely and run the installer again.'
}
if (!(Test-Path (Join-Path $source 'CSXS\manifest.xml'))) { throw 'Extract the entire ZIP first.' }
$manifest = Get-Content (Join-Path $PSScriptRoot 'update-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.bundleId -ne $bundle) { throw 'Incorrect package identity.' }
foreach ($entry in $manifest.files.PSObject.Properties) {
    $file = Join-Path $source $entry.Name
    if (!(Test-Path $file)) { throw "Missing file: $($entry.Name)" }
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $entry.Value) { throw "Checksum mismatch: $($entry.Name)" }
}
New-Item -ItemType Directory -Force $base | Out-Null
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
Copy-Item -LiteralPath $source -Destination $stage -Recurse
$moved = $false
try {
    if (Test-Path $backup) { Remove-Item -Recurse -Force $backup }
    if (Test-Path $target) { Move-Item -LiteralPath $target -Destination $backup; $moved = $true }
    Move-Item -LiteralPath $stage -Destination $target
    foreach ($runtime in '9','10','11','12') {
        $key = "HKCU:\Software\Adobe\CSXS.$runtime"
        New-Item -Path $key -Force | Out-Null
        New-ItemProperty -Path $key -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
    }
} catch {
    if ($moved -and (Test-Path $backup)) {
        if (Test-Path $target) { Remove-Item -Recurse -Force $target }
        Move-Item -LiteralPath $backup -Destination $target
    }
    throw
}
Write-Host 'Montazhopa 3 installed for the current Windows account.'
Write-Host 'Start Premiere: Window > Extensions (Legacy) > Montazhopa.'
Write-Host 'Your previous panel is saved in com.victor.motionviewer.previous.'
Write-Host 'Internet updates are OFF. Your personal assets are stored separately.'
