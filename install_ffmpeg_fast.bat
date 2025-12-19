@echo off
echo Downloading FFmpeg with curl...
curl -L -o ffmpeg.zip https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

echo Extracting FFmpeg...
powershell -command "Expand-Archive -Path ffmpeg.zip -DestinationPath ffmpeg_temp -Force"

echo Locating binaries...
powershell -command "$bin = Get-ChildItem -Path ffmpeg_temp -Recurse -Filter 'ffmpeg.exe' | Select -Expand DirectoryName; Move-Item -Path \"$bin\ffmpeg.exe\" -Destination bin -Force; Move-Item -Path \"$bin\ffprobe.exe\" -Destination bin -Force"

echo Cleanup...
del ffmpeg.zip
rmdir /s /q ffmpeg_temp

echo Done!
