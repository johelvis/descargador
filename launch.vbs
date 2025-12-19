Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run chr(34) & "start.bat" & chr(34), 0
Set WshShell = Nothing
