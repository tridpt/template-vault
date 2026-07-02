' Launches the Template Vault server in the background with no console window.
' Double-click this file to start the server. Logs go to logs\server.out.log.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """" & scriptDir & "\run-template-vault.cmd""", 0, False
