$Action = New-ScheduledTaskAction -Execute "python.exe" -Argument "D:\AI\Claude Code\Project ECHO\api\server.py" -WorkingDirectory "D:\AI\Claude Code\Project ECHO"
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "ProjectECHO_Backend" -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force

Write-Host "--- Project ECHO Backend registered as a Windows Scheduled Task (Runs as SYSTEM at LogOn) ---"
Write-Host "Note: You can also manually start it using: Start-ScheduledTask -TaskName 'ProjectECHO_Backend'"
