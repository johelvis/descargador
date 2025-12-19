@echo off
echo Downloading FFmpeg (v2)...
curl -L -o ffmpeg_v2.zip https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

echo Extracting FFmpeg...
powershell -command "Expand-Archive -Path ffmpeg_v2.zip -DestinationPath ffmpeg_v2_temp -Force"

echo Locating binaries...
powershell -command "$bin = Get-ChildItem -Path ffmpeg_v2_temp -Recurse -Filter 'ffmpeg.exe' | Select -Expand DirectoryName; Move-Item -Path \"$bin\ffmpeg.exe\" -Destination bin -Force; Move-Item -Path \"$bin\ffprobe.exe\" -Destination bin -Force"

echo Cleanup...
del ffmpeg_v2.zip
rmdir /s /q ffmpeg_v2_temp

echo Done!
