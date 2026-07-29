#define MyAppName "LinkPad Agent"
#define MyAppVersion "0.3.0"
#define MyAppPublisher "LinkPad"

[Setup]
AppId={{8BC2D262-6FBA-49AF-BBB5-0A19687371C9}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\LinkPad\Agent
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\installer
OutputBaseFilename=LinkPadAgent-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\Tray\LinkPadAgentTray.exe

[Dirs]
Name: "{commonappdata}\LinkPad\Agent"
Name: "{commonappdata}\LinkPad\Agent\logs"

[Files]
Source: "..\dist\0.3.0\LinkPadAgentService\*"; DestDir: "{app}\Service"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist\0.3.0\LinkPadAgentTray\*"; DestDir: "{app}\Tray"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "LinkPadAgentTray"; ValueData: """{app}\Tray\LinkPadAgentTray.exe"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\Service\LinkPadAgentService.exe"; Parameters: "--startup auto update"; Flags: runhidden waituntilterminated; Check: ShouldUpdateService
Filename: "{app}\Service\LinkPadAgentService.exe"; Parameters: "--startup auto install"; Flags: runhidden waituntilterminated; Check: ShouldInstallService
Filename: "{sys}\sc.exe"; Parameters: "start LinkPadAgent"; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""LinkPad Agent HTTP"" dir=in action=allow protocol=TCP localport=8008 profile=domain,private"; Flags: runhidden waituntilterminated
Filename: "{app}\Tray\LinkPadAgentTray.exe"; Description: "Iniciar o ícone do LinkPad Agent"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop LinkPadAgent"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\Service\LinkPadAgentService.exe"; Parameters: "remove"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveService"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""LinkPad Agent HTTP"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveFirewallRule"

[Code]
function ServiceExists(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{sys}\sc.exe'),
    'query LinkPadAgent',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function ShouldUpdateService(): Boolean;
begin
  Result := ServiceExists();
end;

function ShouldInstallService(): Boolean;
begin
  Result := not ServiceExists();
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  { Remove instancias antigas da bandeja antes de substituir os binarios. }
  Exec(
    ExpandConstant('{sys}\taskkill.exe'),
    '/F /IM LinkPadAgentTray.exe',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  );

  if ServiceExists() then
  begin
    Exec(
      ExpandConstant('{sys}\sc.exe'),
      'stop LinkPadAgent',
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    );
    Sleep(2000);
  end;

  Result := '';
end;
