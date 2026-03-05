' Project ECHO: Stealth Launch Wrapper
' Hides terminal windows for backend and frontend services

Set objShell = WScript.CreateObject("WScript.Shell")
strCommand = WScript.Arguments(0)
objShell.Run strCommand, 0, False
