$url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$zip = "ffmpeg.zip"
$dest = "ffmpeg_temp"

Write-Host "Downloading FFmpeg..."
Invoke-WebRequest -Uri $url -OutFile $zip

Write-Host "Extracting FFmpeg..."
Expand-Archive -Path $zip -DestinationPath $dest -Force

Write-Host "Locating binaries..."
$binPath = Get-ChildItem -Path $dest -Recurse -Filter "ffmpeg.exe" | Select-Object -ExpandProperty DirectoryName

Write-Host "Moving binaries to project bin folder..."
if (-not (Test-Path "bin")) { New-Item -ItemType Directory -Path "bin" }
Move-Item -Path "$binPath\ffmpeg.exe" -Destination "bin" -Force
Move-Item -Path "$binPath\ffprobe.exe" -Destination "bin" -Force

Write-Host "Cleanup..."
Remove-Item -Path $zip -Force
Remove-Item -Path $dest -Recurse -Force

Write-Host "FFmpeg installation complete."
