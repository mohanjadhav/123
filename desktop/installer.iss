; Inno Setup script -> desktop\Output\RapidLabels-Setup.exe
; Build: iscc /DAppVersion=1.0.0 desktop\installer.iss   (after PyInstaller made dist\RapidLabels)
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{8C7E2B1A-5F43-4C1E-9B7D-3A6F1D2C9E01}
AppName=RAPID LABELS by MOHAN
AppVersion={#AppVersion}
AppPublisher=MOHAN
DefaultDirName={autopf}\RapidLabels
DefaultGroupName=RAPID LABELS
DisableProgramGroupPage=yes
; installs for the current user without needing admin rights (can choose "all users" in the dialog)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename=RapidLabels-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\RapidLabels.exe
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Shortcuts:"

[Files]
Source: "..\dist\RapidLabels\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\RAPID LABELS"; Filename: "{app}\RapidLabels.exe"
Name: "{autoprograms}\RAPID LABELS (open in browser)"; Filename: "{app}\RapidLabels.exe"; Parameters: "--browser"
Name: "{autodesktop}\RAPID LABELS"; Filename: "{app}\RapidLabels.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\RapidLabels.exe"; Description: "Start RAPID LABELS now"; Flags: nowait postinstall skipifsilent

; Your labels/data in %LOCALAPPDATA%\RapidLabels are kept on uninstall (so reinstalling keeps everything).
