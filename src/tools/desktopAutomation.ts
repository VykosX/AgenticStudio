// @ts-nocheck
import type { ToolModuleContext } from "../shared/toolModule";

export function registerDesktopAutomationTools(ctx: ToolModuleContext, tools: any[]): void {
  const { tool, z, safeTool, requireCommandExecution, workspaceRoot, resolveInsideWorkspace, resolveExecutablePath, quote, powerShellCommand, powerShellScript, buildCommandResponse, executeManagedCommand, refreshProcessEnvironmentFromWindowsRegistry, getScreenshotDirectorySetting, screenshotsDirectory, escapeForPowerShellSingleQuoted, fileExists, ctl, env, shell, timeoutMs, maxOutputBytes, process, os, path, fsp, json } = ctx as any;
  const unsupportedOnPlatform = (toolName: string, supportedPlatforms = ["win32"]) => json({
    success: false,
    unsupported: true,
    tool: toolName,
    supportedPlatforms,
    message: `${toolName} is not supported on ${process.platform}. Supported: ${supportedPlatforms.join(", ")}.`,
  });
  const windowsOnly = (toolName: string) => process.platform === "win32" ? null : unsupportedOnPlatform(toolName, ["win32"]);
  const clampDelayMs = (value: unknown, fallback = 100) => Math.max(0, Math.min(10000, Math.trunc(Number(value ?? fallback) || 0)));
  const clampMotionSteps = (value: unknown, fallback = 1) => Math.max(1, Math.min(500, Math.trunc(Number(value ?? fallback) || 0)));
  const clampMotionDurationMs = (value: unknown, fallback = 0) => Math.max(0, Math.min(60000, Math.trunc(Number(value ?? fallback) || 0)));
  const powerShellDelay = (delayMs: number) => delayMs > 0 ? `Start-Sleep -Milliseconds ${delayMs}` : "";
  const repairUiAutomationText = (value: unknown, automationId = ""): string => {
    let text = typeof value === "string" ? value : String(value ?? "");
    if (!text) return "";
    const replacements: Array<[RegExp, string]> = [
      [/âˆš/g, "√"],
      [/Ã—/g, "×"],
      [/Ã·/g, "÷"],
      [/â‰¥/g, "≥"],
      [/â‰¤/g, "≤"],
      [/â‰ /g, "≠"],
      [/â‰ˆ/g, "≈"],
      [/âˆ’/g, "−"],
      [/â€“/g, "–"],
      [/â€”/g, "—"],
      [/â€²/g, "′"],
      [/â€³/g, "″"],
    ];
    for (const [pattern, next] of replacements) {
      text = text.replace(pattern, next);
    }
    if (/^CalculatorExpression$/i.test(String(automationId || "")) || /^Expression is\b/i.test(text)) {
      text = text
        .replace(/[ï¿½�]\(/g, "√(")
        .replace(/\s+[ï¿½�]\s+/g, " ÷ ")
        .replace(/\sx\s/g, " × ");
    }
    return text.trim();
  };
  const normalizeUiAutomationControlRecord = (entry: any): any => {
    if (!entry || typeof entry !== "object") return entry;
    return {
      ...entry,
      name: repairUiAutomationText(entry.name, entry.automationId),
      automationId: typeof entry.automationId === "string" ? entry.automationId : String(entry.automationId ?? ""),
      className: typeof entry.className === "string" ? entry.className : String(entry.className ?? ""),
      localizedControlType: typeof entry.localizedControlType === "string" ? entry.localizedControlType : String(entry.localizedControlType ?? ""),
      controlType: typeof entry.controlType === "string" ? entry.controlType : String(entry.controlType ?? ""),
      frameworkId: typeof entry.frameworkId === "string" ? entry.frameworkId : String(entry.frameworkId ?? ""),
      supportedPatterns: Array.isArray(entry.supportedPatterns) ? entry.supportedPatterns.map((item: unknown) => String(item ?? "")) : [],
    };
  };
  const normalizeDesktopBoundsRecord = (entry: any) => {
    if (!entry || typeof entry !== "object") return null;
    const x = Number(entry.x);
    const y = Number(entry.y);
    const width = Number(entry.width);
    const height = Number(entry.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    return {
      x: Math.trunc(x),
      y: Math.trunc(y),
      width: Math.max(0, Math.trunc(width)),
      height: Math.max(0, Math.trunc(height)),
    };
  };
  const normalizeDesktopPointRecord = (entry: any) => {
    if (!entry || typeof entry !== "object") return null;
    const x = Number(entry.x);
    const y = Number(entry.y);
    if (![x, y].every(Number.isFinite)) return null;
    return { x: Math.trunc(x), y: Math.trunc(y) };
  };
  const deriveDesktopCenterFromBounds = (bounds: any) => bounds
    ? {
      x: bounds.x + Math.floor(bounds.width / 2),
      y: bounds.y + Math.floor(bounds.height / 2),
    }
    : null;
  const inferWin32ControlType = (className: unknown) => {
    const lower = String(className || "").trim().toLowerCase();
    if (!lower) return "Window";
    if (lower === "button") return "Button";
    if (lower === "edit") return "Edit";
    if (lower === "combobox") return "ComboBox";
    if (lower === "static") return "Text";
    if (lower.includes("trackbar")) return "Slider";
    if (lower.includes("scrollbar")) return "ScrollBar";
    if (lower.includes("listview")) return "ListView";
    if (lower.includes("treeview")) return "TreeView";
    if (lower.includes("toolbar")) return "ToolBar";
    if (lower.includes("statusbar")) return "StatusBar";
    if (lower.includes("richedit")) return "RichEdit";
    if (lower.includes("directui")) return "DirectUI";
    if (lower.includes("afx:")) return "MfcWindow";
    return "CustomWindow";
  };
  const getWin32MessageHints = (controlType: unknown, className: unknown) => {
    const hints = new Set<string>();
    const normalizedType = String(controlType || "").trim().toLowerCase();
    const normalizedClass = String(className || "").trim().toLowerCase();
    if (normalizedType === "button" || normalizedClass === "button") {
      hints.add("BM_CLICK");
      hints.add("BM_GETCHECK");
      hints.add("BM_SETCHECK");
    }
    if (normalizedType === "edit" || normalizedClass === "edit" || normalizedClass.includes("richedit")) {
      hints.add("WM_GETTEXT");
      hints.add("WM_GETTEXTLENGTH");
      hints.add("WM_SETTEXT");
      hints.add("EM_SETSEL");
    }
    if (normalizedType === "combobox" || normalizedClass === "combobox") {
      hints.add("CB_SHOWDROPDOWN");
      hints.add("CB_GETCURSEL");
      hints.add("CB_SETCURSEL");
    }
    if (normalizedType === "slider" || normalizedClass.includes("trackbar")) {
      hints.add("TBM_GETPOS");
      hints.add("TBM_SETPOS");
    }
    if (normalizedType === "scrollbar" || normalizedClass.includes("scrollbar")) {
      hints.add("SBM_GETPOS");
      hints.add("SBM_SETPOS");
    }
    if (hints.size === 0) {
      hints.add("WM_LBUTTONDOWN");
      hints.add("WM_LBUTTONUP");
      hints.add("WM_MOUSEMOVE");
    }
    return Array.from(hints);
  };
  const normalizeDesktopControlRecord = (entry: any): any => {
    if (!entry || typeof entry !== "object") return entry;
    const source = String(entry.source || (entry.frameworkId === "win32" ? "win32" : "uia")).trim().toLowerCase() || "uia";
    if (source !== "win32") {
      const normalized = normalizeUiAutomationControlRecord(entry);
      const bounds = normalizeDesktopBoundsRecord(normalized.bounds);
      const windowRelativeBounds = normalizeDesktopBoundsRecord(normalized.windowRelativeBounds);
      return {
        ...normalized,
        source: "uia",
        bounds,
        windowRelativeBounds,
        center: normalizeDesktopPointRecord(normalized.center) || deriveDesktopCenterFromBounds(bounds),
        windowRelativeCenter: normalizeDesktopPointRecord(normalized.windowRelativeCenter) || deriveDesktopCenterFromBounds(windowRelativeBounds),
        messageDispatchable: false,
        messageHints: [],
        windowText: repairUiAutomationText(normalized.windowText, normalized.automationId),
      };
    }
    const className = typeof entry.className === "string" ? entry.className : String(entry.className ?? "");
    const inferredControlType = inferWin32ControlType(className);
    const bounds = normalizeDesktopBoundsRecord(entry.bounds);
    const windowRelativeBounds = normalizeDesktopBoundsRecord(entry.windowRelativeBounds);
    const windowText = repairUiAutomationText(entry.windowText, entry.automationId);
    const name = repairUiAutomationText(entry.name || windowText || className, entry.automationId) || className;
    const supportedPatterns = Array.isArray(entry.supportedPatterns) ? entry.supportedPatterns.map((item: unknown) => String(item ?? "")) : [];
    const messageHints = Array.isArray(entry.messageHints)
      ? entry.messageHints.map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
      : [];
    return {
      ...entry,
      source: "win32",
      name,
      windowText,
      automationId: typeof entry.automationId === "string" ? entry.automationId : String(entry.automationId ?? ""),
      className,
      localizedControlType: typeof entry.localizedControlType === "string" && entry.localizedControlType
        ? entry.localizedControlType
        : inferredControlType,
      controlType: typeof entry.controlType === "string" && entry.controlType
        ? entry.controlType
        : inferredControlType,
      frameworkId: typeof entry.frameworkId === "string" && entry.frameworkId
        ? entry.frameworkId
        : "win32",
      supportedPatterns,
      bounds,
      windowRelativeBounds,
      center: normalizeDesktopPointRecord(entry.center) || deriveDesktopCenterFromBounds(bounds),
      windowRelativeCenter: normalizeDesktopPointRecord(entry.windowRelativeCenter) || deriveDesktopCenterFromBounds(windowRelativeBounds),
      nativeWindowHandle: typeof entry.nativeWindowHandle === "string" ? entry.nativeWindowHandle : String(entry.nativeWindowHandle ?? ""),
      parentWindowHandle: typeof entry.parentWindowHandle === "string" ? entry.parentWindowHandle : String(entry.parentWindowHandle ?? ""),
      controlId: Number.isFinite(Number(entry.controlId)) ? Math.trunc(Number(entry.controlId)) : 0,
      isEnabled: entry.isEnabled === false ? false : Boolean(entry.isEnabled),
      isOffscreen: Boolean(entry.isOffscreen),
      hasKeyboardFocus: Boolean(entry.hasKeyboardFocus),
      messageDispatchable: entry.messageDispatchable === false ? false : true,
      messageHints: Array.from(new Set([...messageHints, ...getWin32MessageHints(entry.controlType || inferredControlType, className)])),
    };
  };
  const resolveWindowsMessageCode = (value: unknown): number => {
    const raw = String(value ?? "").trim();
    if (!raw) throw new Error("message is required.");
    const upper = raw.toUpperCase();
    const aliases: Record<string, number> = {
      WM_NULL: 0x0000,
      WM_SETTEXT: 0x000C,
      WM_GETTEXT: 0x000D,
      WM_GETTEXTLENGTH: 0x000E,
      WM_COMMAND: 0x0111,
      WM_HSCROLL: 0x0114,
      WM_VSCROLL: 0x0115,
      WM_MOUSEMOVE: 0x0200,
      WM_LBUTTONDOWN: 0x0201,
      WM_LBUTTONUP: 0x0202,
      WM_RBUTTONDOWN: 0x0204,
      WM_RBUTTONUP: 0x0205,
      BM_GETCHECK: 0x00F0,
      BM_SETCHECK: 0x00F1,
      BM_CLICK: 0x00F5,
      EM_SETSEL: 0x00B1,
      CB_GETCURSEL: 0x0147,
      CB_SETCURSEL: 0x014E,
      CB_SHOWDROPDOWN: 0x014F,
      SBM_SETPOS: 0x00E0,
      SBM_GETPOS: 0x00E1,
      TBM_GETPOS: 0x0400,
      TBM_SETPOS: 0x0405,
    };
    if (Object.prototype.hasOwnProperty.call(aliases, upper)) return aliases[upper];
    if (/^0x[0-9a-f]+$/i.test(raw)) return Number.parseInt(raw.slice(2), 16);
    if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
    throw new Error(`Unsupported Windows message '${raw}'. Use a known alias like BM_CLICK or a numeric code.`);
  };
  const parseWindowsIntegralParameter = (value: unknown, fieldName: string): number => {
    const raw = String(value ?? "").trim();
    if (!raw) return 0;
    if (/^0x[0-9a-f]+$/i.test(raw)) return Number.parseInt(raw.slice(2), 16);
    if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
    throw new Error(`${fieldName} must be an integer or hex string like 0x0405.`);
  };
  const resolveToolTempDirectory = async () => {
    const candidates = [
      path.join(workspaceRoot, "screenshots", "tool-temp"),
      path.join(os.tmpdir(), "agentic-studio-tool-temp"),
    ];
    for (const candidate of candidates) {
      try {
        await fsp.mkdir(candidate, { recursive: true });
        return candidate;
      } catch {}
    }
    throw new Error("Unable to create a temporary tool directory.");
  };
  const runPowerShellScriptFile = async (scriptContents: string, prefix: string) => {
    const tempDirectory = await resolveToolTempDirectory();
    const scriptPath = path.join(tempDirectory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
    await fsp.writeFile(scriptPath, scriptContents, "utf8");
    const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${quote(scriptPath)}`;
    try {
      return await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
    } finally {
      await fsp.rm(scriptPath, { force: true }).catch(() => {});
    }
  };
  const compactCommandError = (stderr: unknown, error: unknown, fallback = "Command failed."): string => {
    const sources = [stderr, error]
      .map((value) => typeof value === "string" ? value : String(value ?? ""))
      .filter(Boolean);
    for (const source of sources) {
      const lines = source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^at\s/i.test(line))
        .filter((line) => !/^(categoryinfo|fullyqualifiederrorid)\s*:/i.test(line))
        .filter((line) => !/^[+~]/.test(line));
      const preferred = lines.find((line) => !/^command failed:/i.test(line));
      if (preferred) return preferred;
      if (lines[0]) return lines[0];
    }
    return fallback;
  };
  const buildWindowsTopLevelWindowCatalogContext = (apiClassName = "ResolveWinApi", variableName = "visibleWindows") => [
    "$resolveSig = @'",
    "using System;",
    "using System.Text;",
    "using System.Runtime.InteropServices;",
    "public struct RESOLVERECT { public int Left; public int Top; public int Right; public int Bottom; }",
    `public static class ${apiClassName} {`,
    "  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);",
    "  [DllImport(\"user32.dll\")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);",
    "  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);",
    "  [DllImport(\"user32.dll\")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);",
    "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);",
    "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RESOLVERECT rect);",
    "  [DllImport(\"dwmapi.dll\")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RESOLVERECT pvAttribute, int cbAttribute);",
    "}",
    "'@;",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "Add-Type -TypeDefinition $resolveSig",
    "function Get-ResolvedRect([IntPtr]$handle) {",
    "  $rect = New-Object RESOLVERECT",
    `  $dwmResult = [${apiClassName}]::DwmGetWindowAttribute($handle, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][RESOLVERECT]))`,
    `  if ($dwmResult -ne 0) { [${apiClassName}]::GetWindowRect($handle, [ref]$rect) | Out-Null }`,
    "  return $rect",
    "}",
    "function Test-UsableWindowHandle([IntPtr]$handle) {",
    "  if ($handle -eq [IntPtr]::Zero) { return $false }",
    "  $rect = Get-ResolvedRect $handle",
    "  $width = $rect.Right - $rect.Left",
    "  $height = $rect.Bottom - $rect.Top",
    "  if ($width -lt 120 -or $height -lt 120) { return $false }",
    "  if ($rect.Left -le -30000 -and $rect.Top -le -30000) { return $false }",
    "  return $true",
    "}",
    "function Test-WindowContainsProcess([IntPtr]$handle, [int]$processId) {",
    "  if ($handle -eq [IntPtr]::Zero -or $processId -le 0) { return $false }",
    "  try {",
    "    $root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)",
    "    if ($null -eq $root) { return $false }",
    "    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $processId)",
    "    $descendant = $root.FindFirst([System.Windows.Automation.TreeScope]::Subtree, $condition)",
    "    return $null -ne $descendant",
    "  } catch {",
    "    return $false",
    "  }",
    "}",
    "function Resolve-HostProxyEntry {",
    "  param(",
    "    [object[]]$entries,",
    "    [object]$sourceEntry,",
    "    [int]$sourceProcessId",
    "  )",
    "  if ($null -eq $sourceEntry) { return $null }",
    "  $sourceTitle = [string]$sourceEntry.MainWindowTitle",
    "  if (-not $sourceTitle) { return $null }",
    "  $proxyCandidates = @($entries | Where-Object { $_.ProcessName -eq 'ApplicationFrameHost' -and $_.MainWindowTitle -eq $sourceTitle })",
    "  if ($proxyCandidates.Count -eq 0) { return $null }",
    "  return @($proxyCandidates | Sort-Object @{ Expression = { try { if (Test-UsableWindowHandle([IntPtr]::new([long]([string]$_.MainWindowHandle)))) { 0 } else { 1 } } catch { 1 } } }, @{ Expression = { try { if (Test-WindowContainsProcess([IntPtr]::new([long]([string]$_.MainWindowHandle)), $sourceProcessId)) { 0 } else { 1 } } catch { 1 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { $_.Id } } | Select-Object -First 1)",
    "}",
    "$processMap = @{}",
    "Get-Process | ForEach-Object { $processMap[[int]$_.Id] = $_ }",
    `$${variableName}List = New-Object 'System.Collections.Generic.List[object]'`,
    `$${variableName}Callback = [${apiClassName}+EnumWindowsProc]{`,
    "  param($hWnd, $lParam)",
    "  try {",
    `    if (-not [${apiClassName}]::IsWindowVisible($hWnd)) { return $true }`,
    "    $titleBuilder = New-Object System.Text.StringBuilder 1024",
    `    [${apiClassName}]::GetWindowText($hWnd, $titleBuilder, $titleBuilder.Capacity) | Out-Null`,
    "    $windowTitle = $titleBuilder.ToString()",
    "    if (-not $windowTitle) { return $true }",
    "    $windowPid = [uint32]0",
    `    [${apiClassName}]::GetWindowThreadProcessId($hWnd, [ref]$windowPid) | Out-Null`,
    "    if (-not $processMap.ContainsKey([int]$windowPid)) { return $true }",
    "    $proc = $processMap[[int]$windowPid]",
    "    $classBuilder = New-Object System.Text.StringBuilder 512",
    `    [${apiClassName}]::GetClassName($hWnd, $classBuilder, $classBuilder.Capacity) | Out-Null`,
    "    $rect = Get-ResolvedRect $hWnd",
    "    $width = [Math]::Max(0, $rect.Right - $rect.Left)",
    "    $height = [Math]::Max(0, $rect.Bottom - $rect.Top)",
    `$${variableName}List.Add([pscustomobject]@{`,
    "      Id = $proc.Id",
    "      ProcessId = $proc.Id",
    "      ProcessName = $proc.ProcessName",
    "      MainWindowTitle = $windowTitle",
    "      MainWindowHandle = [string]$hWnd.ToInt64()",
    "      Path = $proc.Path",
    "      ClassName = $classBuilder.ToString()",
    "      bounds = @{ x = $rect.Left; y = $rect.Top; width = $width; height = $height }",
    "    }) | Out-Null",
    "  } catch {}",
    "  return $true",
    "}",
    `[${apiClassName}]::EnumWindows($${variableName}Callback, [IntPtr]::Zero) | Out-Null`,
    `$${variableName} = @($${variableName}List.ToArray())`,
  ];
  const buildWindowsResolvedWindowContext = (pid: number) => [
    ...buildWindowsTopLevelWindowCatalogContext("ResolveWinApi", "visibleWindows"),
    `$pidValue = ${Number(pid)}`,
    "$proc = Get-Process -Id $pidValue -ErrorAction Stop",
    "$candidateEntries = @()",
    "if ($proc.Id -gt 0) { $candidateEntries += @($visibleWindows | Where-Object { $_.Id -eq $proc.Id }) }",
    "if ($proc.MainWindowTitle) { $candidateEntries += @($visibleWindows | Where-Object { $_.MainWindowTitle -eq $proc.MainWindowTitle }) }",
    "if ($proc.ProcessName -eq 'ApplicationFrameHost' -and $proc.MainWindowTitle) { $candidateEntries += @($visibleWindows | Where-Object { $_.ProcessName -eq 'ApplicationFrameHost' -and $_.MainWindowTitle -eq $proc.MainWindowTitle }) }",
    "$candidateEntries = @($candidateEntries | Sort-Object MainWindowHandle -Unique)",
    "$samePidUsableCount = @($candidateEntries | Where-Object { $_.Id -eq $proc.Id -and (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) }).Count",
    "$preferredEntries = @($candidateEntries | Sort-Object @{ Expression = { if (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) { 0 } else { 1 } } }, @{ Expression = { if ($_.ProcessName -eq 'ApplicationFrameHost' -and (Test-WindowContainsProcess([IntPtr]::new([long]$_.MainWindowHandle), [int]$proc.Id))) { 0 } elseif ($_.Id -eq $proc.Id) { 1 } elseif ($samePidUsableCount -gt 0) { 2 } elseif ($_.ProcessName -eq 'ApplicationFrameHost' -and $_.MainWindowTitle -eq $proc.MainWindowTitle) { 1 } else { 3 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } })",
    "$resolvedEntry = $preferredEntries | Select-Object -First 1",
    "if (-not $resolvedEntry) {",
    "  foreach ($window in @($visibleWindows | Sort-Object @{ Expression = { if (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) { 0 } else { 1 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { $_.Id } })) {",
    "    try {",
    "      $candidateHandle = [IntPtr]::new([long]$window.MainWindowHandle)",
    "      if ($candidateHandle -eq [IntPtr]::Zero) { continue }",
    "      $rootElement = [System.Windows.Automation.AutomationElement]::FromHandle($candidateHandle)",
    "      if ($null -eq $rootElement) { continue }",
    "      $processCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$proc.Id)",
    "      $descendant = $rootElement.FindFirst([System.Windows.Automation.TreeScope]::Subtree, $processCondition)",
    "      if ($descendant) { $resolvedEntry = $window; break }",
    "    } catch {}",
    "  }",
    "}",
    "if (-not $resolvedEntry) {",
    "  $resolvedEntry = [pscustomobject]@{",
    "    Id = $proc.Id",
    "    ProcessName = $proc.ProcessName",
    "    MainWindowTitle = $proc.MainWindowTitle",
    "    MainWindowHandle = [string]$proc.MainWindowHandle",
    "    Path = $proc.Path",
    "    ClassName = $null",
    "  }",
    "}",
    "$resolvedHandle = [IntPtr]::new([long]$resolvedEntry.MainWindowHandle)",
    "$resolvedPid = [int]$resolvedEntry.Id",
    "$resolvedTitle = $resolvedEntry.MainWindowTitle",
    "$resolvedProcessName = $resolvedEntry.ProcessName",
    "$resolvedPath = $resolvedEntry.Path",
    "$resolvedClassName = $resolvedEntry.ClassName",
    "$resolvedRect = Get-ResolvedRect $resolvedHandle",
  ];
  const runTemporaryExecutableScriptFile = async (
    scriptContents: string,
    prefix: string,
    extension: string,
    executable: string,
    args: string[] = [],
    localTimeoutMs?: number,
    options?: { prependArgs?: string[] },
  ) => {
    const tempDirectory = await resolveToolTempDirectory();
    const scriptPath = path.join(tempDirectory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension.replace(/^\./, "")}`);
    await fsp.writeFile(scriptPath, scriptContents, "utf8");
    const argString = [
      ...((options?.prependArgs || []).map((entry) => String(entry))),
      quote(scriptPath),
      ...args.map((entry) => quote(String(entry))),
    ].join(" ");
    const command = `${quote(executable)} ${argString}`.trim();
    try {
      return await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(localTimeoutMs || timeoutMs, 120000), maxOutputBytes);
    } finally {
      await fsp.rm(scriptPath, { force: true }).catch(() => {});
    }
  };
  const buildWindowsInputGuard = (options: { pid?: unknown; windowId?: unknown; lockUserInput?: unknown; includeMouseApi?: boolean }) => {
    const pidValue = typeof options?.pid === "number" && Number.isFinite(Number(options.pid)) ? Math.trunc(Number(options.pid)) : 0;
    const windowIdValue = String(options?.windowId || "").trim();
    const lockRequested = Boolean(options?.lockUserInput);
    const mouseMembers = options?.includeMouseApi
      ? [
        "  [DllImport(\"user32.dll\")] public static extern bool SetCursorPos(int X, int Y);",
        "  [DllImport(\"user32.dll\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);",
        "  [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);",
      ]
      : [];
    return [
      "$sig = @'",
      "using System;",
      "using System.Text;",
      "using System.Runtime.InteropServices;",
      "public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
      "public static class WinApi {",
      "  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);",
      "  public delegate bool EnumChildWindowsProc(IntPtr hWnd, IntPtr lParam);",
      "  [DllImport(\"user32.dll\")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);",
      "  [DllImport(\"user32.dll\")] public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildWindowsProc lpEnumFunc, IntPtr lParam);",
      "  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);",
      "  [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
      "  [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);",
      "  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);",
      "  [DllImport(\"user32.dll\")] public static extern bool IsWindowEnabled(IntPtr hWnd);",
      "  [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);",
      "  [DllImport(\"user32.dll\")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);",
      "  [DllImport(\"user32.dll\")] public static extern IntPtr GetParent(IntPtr hWnd);",
      "  [DllImport(\"user32.dll\")] public static extern int GetDlgCtrlID(IntPtr hWnd);",
      "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);",
      "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);",
      "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
      "  [DllImport(\"user32.dll\")] public static extern bool BlockInput(bool fBlockIt);",
      "  [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);",
      "  [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);",
      "  [DllImport(\"dwmapi.dll\")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);",
      ...mouseMembers,
      "}",
      "'@;",
      "Add-Type -AssemblyName Microsoft.VisualBasic",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName UIAutomationClient",
      "Add-Type $sig",
      `$targetPid = ${pidValue}`,
      `$targetWindowId = ${windowIdValue ? escapeForPowerShellSingleQuoted(windowIdValue) : "''"}`,
      `$lockUserInputRequested = ${lockRequested ? "$true" : "$false"}`,
      "$lockUserInputApplied = $false",
      "$resolvedTargetHandle = [IntPtr]::Zero",
      "$resolvedTargetPid = $null",
      "$resolvedTargetProcessName = $null",
      "$resolvedTitle = $null",
      "$resolvedPath = $null",
      "$resolvedRect = New-Object RECT",
      "$SW_RESTORE = 9",
      "function Get-ResolvedRect([IntPtr]$handle) {",
      "  $rect = New-Object RECT",
      "  $dwmResult = [WinApi]::DwmGetWindowAttribute($handle, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][RECT]))",
      "  if ($dwmResult -ne 0) { [WinApi]::GetWindowRect($handle, [ref]$rect) | Out-Null }",
      "  return $rect",
      "}",
      "function Test-UsableWindowHandle([IntPtr]$handle) {",
      "  if ($handle -eq [IntPtr]::Zero) { return $false }",
      "  $rect = Get-ResolvedRect $handle",
      "  $width = $rect.Right - $rect.Left",
      "  $height = $rect.Bottom - $rect.Top",
      "  if ($width -lt 120 -or $height -lt 120) { return $false }",
      "  if ($rect.Left -le -30000 -and $rect.Top -le -30000) { return $false }",
      "  return $true",
      "}",
      "function Test-WindowContainsProcess([IntPtr]$handle, [int]$processId) {",
      "  if ($handle -eq [IntPtr]::Zero -or $processId -le 0) { return $false }",
      "  try {",
      "    $root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)",
      "    if ($null -eq $root) { return $false }",
      "    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $processId)",
      "    $descendant = $root.FindFirst([System.Windows.Automation.TreeScope]::Subtree, $condition)",
      "    return $null -ne $descendant",
      "  } catch {",
      "    return $false",
      "  }",
      "}",
      "function Resolve-HostProxyEntry {",
      "  param(",
      "    [object[]]$entries,",
      "    [object]$sourceEntry,",
      "    [int]$sourceProcessId",
      "  )",
      "  if ($null -eq $sourceEntry) { return $null }",
      "  $sourceTitle = [string]$sourceEntry.MainWindowTitle",
      "  if (-not $sourceTitle) { return $null }",
      "  $proxyCandidates = @($entries | Where-Object { $_.ProcessName -eq 'ApplicationFrameHost' -and $_.MainWindowTitle -eq $sourceTitle })",
      "  if ($proxyCandidates.Count -eq 0) { return $null }",
      "  return @($proxyCandidates | Sort-Object @{ Expression = { try { if (Test-UsableWindowHandle([IntPtr]::new([long]([string]$_.MainWindowHandle)))) { 0 } else { 1 } } catch { 1 } } }, @{ Expression = { try { if (Test-WindowContainsProcess([IntPtr]::new([long]([string]$_.MainWindowHandle)), $sourceProcessId)) { 0 } else { 1 } } catch { 1 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { $_.Id } } | Select-Object -First 1)",
      "}",
      "$processMap = @{}",
      "Get-Process | ForEach-Object { $processMap[[int]$_.Id] = $_ }",
      "$visibleWindowsList = New-Object 'System.Collections.Generic.List[object]'",
      "$visibleWindowsCallback = [WinApi+EnumWindowsProc]{",
      "  param($hWnd, $lParam)",
      "  try {",
      "    if (-not [WinApi]::IsWindowVisible($hWnd)) { return $true }",
      "    $titleBuilder = New-Object System.Text.StringBuilder 1024",
      "    [WinApi]::GetWindowText($hWnd, $titleBuilder, $titleBuilder.Capacity) | Out-Null",
      "    $windowTitle = $titleBuilder.ToString()",
      "    if (-not $windowTitle) { return $true }",
      "    $windowPid = [uint32]0",
      "    [WinApi]::GetWindowThreadProcessId($hWnd, [ref]$windowPid) | Out-Null",
      "    if (-not $processMap.ContainsKey([int]$windowPid)) { return $true }",
      "    $proc = $processMap[[int]$windowPid]",
      "    $classBuilder = New-Object System.Text.StringBuilder 512",
      "    [WinApi]::GetClassName($hWnd, $classBuilder, $classBuilder.Capacity) | Out-Null",
      "    $visibleWindowsList.Add([pscustomobject]@{",
      "      Id = $proc.Id",
      "      ProcessName = $proc.ProcessName",
      "      MainWindowTitle = $windowTitle",
      "      MainWindowHandle = [string]$hWnd.ToInt64()",
      "      Path = $proc.Path",
      "      ClassName = $classBuilder.ToString()",
      "    }) | Out-Null",
      "  } catch {}",
      "  return $true",
      "}",
      "[WinApi]::EnumWindows($visibleWindowsCallback, [IntPtr]::Zero) | Out-Null",
      "$visibleWindows = @($visibleWindowsList.ToArray())",
      "if ($targetWindowId) {",
      "  $match = @($visibleWindows | Where-Object { [string]$_.MainWindowHandle -eq $targetWindowId } | Select-Object -First 1)",
      "  if ($match) {",
      "    $proxy = $null",
      "    if ($match.Path -like 'C:\\Program Files\\WindowsApps\\*' -or $match.ClassName -eq 'Windows.UI.Core.CoreWindow') {",
      "      $proxy = Resolve-HostProxyEntry $visibleWindows $match ([int]$match.Id)",
      "    }",
      "    $matchUsable = Test-UsableWindowHandle([IntPtr]::new([long]$match.MainWindowHandle))",
      "    $proxyUsable = $proxy -and (Test-UsableWindowHandle([IntPtr]::new([long]$proxy.MainWindowHandle)))",
      "    if ($proxyUsable) { $resolvedEntry = $proxy } elseif ($matchUsable) { $resolvedEntry = $match } elseif ($proxy) { $resolvedEntry = $proxy } else { $resolvedEntry = $match }",
      "    $resolvedTargetHandle = [IntPtr]::new([long]$resolvedEntry.MainWindowHandle)",
      "    $resolvedTargetPid = [int]$resolvedEntry.Id",
      "    $resolvedTargetProcessName = [string]$resolvedEntry.ProcessName",
      "  } else {",
      "    $candidateHandle = [IntPtr]::new([long]$targetWindowId)",
      "    $candidateTitleBuilder = New-Object System.Text.StringBuilder 1024",
      "    [WinApi]::GetWindowText($candidateHandle, $candidateTitleBuilder, $candidateTitleBuilder.Capacity) | Out-Null",
      "    $candidateTitle = $candidateTitleBuilder.ToString()",
      "    $candidateClassBuilder = New-Object System.Text.StringBuilder 512",
      "    [WinApi]::GetClassName($candidateHandle, $candidateClassBuilder, $candidateClassBuilder.Capacity) | Out-Null",
      "    $candidateClass = $candidateClassBuilder.ToString()",
      "    $candidatePid = [uint32]0",
      "    [WinApi]::GetWindowThreadProcessId($candidateHandle, [ref]$candidatePid) | Out-Null",
      "    $candidateProc = if ($candidatePid -gt 0 -and $processMap.ContainsKey([int]$candidatePid)) { $processMap[[int]$candidatePid] } else { $null }",
      "    $candidateProxy = $null",
      "    if ($candidateTitle -and (($candidateProc -and $candidateProc.Path -like 'C:\\Program Files\\WindowsApps\\*') -or $candidateClass -eq 'Windows.UI.Core.CoreWindow' -or $candidatePid -le 0)) {",
      "      $candidateProxy = Resolve-HostProxyEntry $visibleWindows ([pscustomobject]@{ MainWindowTitle = $candidateTitle; Id = [int]$candidatePid }) ([int]$candidatePid)",
      "    }",
      "    if ($candidateProxy) {",
      "      $resolvedTargetHandle = [IntPtr]::new([long]$candidateProxy.MainWindowHandle)",
      "      $resolvedTargetPid = [int]$candidateProxy.Id",
      "      $resolvedTargetProcessName = [string]$candidateProxy.ProcessName",
      "    } elseif (Test-UsableWindowHandle($candidateHandle)) {",
      "      $resolvedTargetHandle = $candidateHandle",
      "      $resolvedTargetPid = [int]$candidatePid",
      "      $resolvedTargetProcessName = if ($candidateProc) { [string]$candidateProc.ProcessName } else { $null }",
      "    } else {",
      "      throw \"No matching visible window found for exact window_id '$targetWindowId'.\"",
      "    }",
      "  }",
      "} elseif ($targetPid -gt 0) {",
      "  $proc = Get-Process -Id $targetPid -ErrorAction Stop",
      "  $candidateEntries = @($visibleWindows | Where-Object { $_.Id -eq $proc.Id })",
      "  if ($proc.MainWindowTitle) { $candidateEntries += @($visibleWindows | Where-Object { $_.MainWindowTitle -eq $proc.MainWindowTitle }) }",
      "  $candidateEntries = @($candidateEntries | Sort-Object MainWindowHandle -Unique)",
      "  $samePidUsableCount = @($candidateEntries | Where-Object { $_.Id -eq $proc.Id -and (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) }).Count",
      "  $resolvedEntry = @($candidateEntries | Sort-Object @{ Expression = { if (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) { 0 } else { 1 } } }, @{ Expression = { if ($_.ProcessName -eq 'ApplicationFrameHost' -and (Test-WindowContainsProcess([IntPtr]::new([long]$_.MainWindowHandle), [int]$proc.Id))) { 0 } elseif ($_.Id -eq $proc.Id) { 1 } elseif ($samePidUsableCount -gt 0) { 2 } elseif ($_.ProcessName -eq 'ApplicationFrameHost' -and $_.MainWindowTitle -eq $proc.MainWindowTitle) { 1 } else { 3 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } } | Select-Object -First 1)",
      "  if (-not $resolvedEntry) {",
      "    foreach ($window in @($visibleWindows | Sort-Object @{ Expression = { if (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) { 0 } else { 1 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { $_.Id } })) {",
      "      try {",
      "        $candidateHandle = [IntPtr]::new([long]$window.MainWindowHandle)",
      "        if ($candidateHandle -eq [IntPtr]::Zero) { continue }",
      "        $rootElement = [System.Windows.Automation.AutomationElement]::FromHandle($candidateHandle)",
      "        if ($null -eq $rootElement) { continue }",
      "        $processCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$proc.Id)",
      "        $descendant = $rootElement.FindFirst([System.Windows.Automation.TreeScope]::Subtree, $processCondition)",
      "        if ($descendant) { $resolvedEntry = $window; break }",
      "      } catch {}",
      "    }",
      "  }",
      "  if ($resolvedEntry) {",
      "    $resolvedTargetHandle = [IntPtr]::new([long]$resolvedEntry.MainWindowHandle)",
      "    $resolvedTargetPid = [int]$resolvedEntry.Id",
      "    $resolvedTargetProcessName = [string]$resolvedEntry.ProcessName",
      "  } else {",
      "    $resolvedTargetHandle = $proc.MainWindowHandle",
      "    $resolvedTargetPid = $proc.Id",
      "    $resolvedTargetProcessName = [string]$proc.ProcessName",
      "  }",
      "} else {",
      "  $resolvedTargetHandle = [WinApi]::GetForegroundWindow()",
      "  if ($resolvedTargetHandle -ne [IntPtr]::Zero) {",
      "    $foregroundPid = [uint32]0",
      "    [WinApi]::GetWindowThreadProcessId($resolvedTargetHandle, [ref]$foregroundPid) | Out-Null",
      "    if ($foregroundPid -gt 0) {",
      "      $resolvedTargetPid = [int]$foregroundPid",
      "      if ($processMap.ContainsKey([int]$foregroundPid)) { $resolvedTargetProcessName = [string]$processMap[[int]$foregroundPid].ProcessName }",
      "    }",
      "  }",
      "}",
      "if ($resolvedTargetHandle -eq [IntPtr]::Zero) { throw 'Unable to resolve a target window for input dispatch.' }",
      "try {",
      "  if ([WinApi]::IsIconic($resolvedTargetHandle)) { [WinApi]::ShowWindowAsync($resolvedTargetHandle, $SW_RESTORE) | Out-Null; Start-Sleep -Milliseconds 120 }",
      "} catch {}",
      "try { [WinApi]::SetForegroundWindow($resolvedTargetHandle) | Out-Null; Start-Sleep -Milliseconds 80 } catch {}",
      "$skipPidAppActivate = $targetWindowId -and $resolvedTargetProcessName -match '^(ApplicationFrameHost|ShellExperienceHost|TextInputHost)$'",
      "if ($resolvedTargetPid -and -not $skipPidAppActivate) { try { [Microsoft.VisualBasic.Interaction]::AppActivate([int]$resolvedTargetPid) | Out-Null; Start-Sleep -Milliseconds 80 } catch {} }",
      "$titleBuilder = New-Object System.Text.StringBuilder 1024",
      "try { [WinApi]::GetWindowText($resolvedTargetHandle, $titleBuilder, $titleBuilder.Capacity) | Out-Null; $resolvedTitle = $titleBuilder.ToString() } catch { $resolvedTitle = $null }",
      "if ($resolvedTargetPid -and $processMap.ContainsKey([int]$resolvedTargetPid)) { try { $resolvedPath = $processMap[[int]$resolvedTargetPid].Path } catch { $resolvedPath = $null } }",
      "try { $resolvedRect = Get-ResolvedRect $resolvedTargetHandle } catch { $resolvedRect = New-Object RECT }",
      "if ($lockUserInputRequested) {",
      "  try { $lockUserInputApplied = [WinApi]::BlockInput($true) } catch { $lockUserInputApplied = $false }",
      "  if ($lockUserInputApplied) { Start-Sleep -Milliseconds 50 }",
      "}",
    ];
  };
  const buildWindowsInputGuardFinally = () => [
    "if ($lockUserInputApplied) {",
    "  try { [WinApi]::BlockInput($false) | Out-Null } catch {}",
    "}",
  ];
  const escapeSendKeysText = (value: unknown): string => String(value ?? "")
    .replace(/\r\n|\r|\n/g, "{ENTER}")
    .replace(/[\+\^%~()\{\}\[\]]/g, (char) => `{${char}}`);
  const normalizeVirtualKeyName = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase().replace(/\s+/g, "");
    const aliasMap: Record<string, string> = {
      enter: "Return",
      return: "Return",
      escape: "Escape",
      esc: "Escape",
      tab: "Tab",
      space: "Space",
      backspace: "Back",
      bksp: "Back",
      delete: "Delete",
      del: "Delete",
      insert: "Insert",
      ins: "Insert",
      home: "Home",
      end: "End",
      pageup: "PageUp",
      pgup: "PageUp",
      pagedown: "PageDown",
      pgdn: "PageDown",
      up: "Up",
      down: "Down",
      left: "Left",
      right: "Right",
      ctrl: "ControlKey",
      control: "ControlKey",
      alt: "Menu",
      option: "Menu",
      shift: "ShiftKey",
      win: "LWin",
      leftwin: "LWin",
      rightwin: "RWin",
      apps: "Apps",
      add: "Add",
      plus: "Add",
      subtract: "Subtract",
      minus: "Subtract",
      hyphen: "Subtract",
      multiply: "Multiply",
      nummultiply: "Multiply",
      times: "Multiply",
      divide: "Divide",
      numdivide: "Divide",
      decimal: "Decimal",
      numdecimal: "Decimal",
      separator: "Separator",
      num0: "NumPad0",
      num1: "NumPad1",
      num2: "NumPad2",
      num3: "NumPad3",
      num4: "NumPad4",
      num5: "NumPad5",
      num6: "NumPad6",
      num7: "NumPad7",
      num8: "NumPad8",
      num9: "NumPad9",
    };
    if (aliasMap[lower]) return aliasMap[lower];
    if (/^f([1-9]|1\d|2[0-4])$/.test(lower)) return lower.toUpperCase();
    if (/^[a-z]$/.test(lower)) return lower.toUpperCase();
    if (/^[0-9]$/.test(lower)) return `D${lower}`;
    return raw;
  };
  const normalizeSendKeysCombo = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase().replace(/\s+/g, "");
    const keyMap: Record<string, string> = {
      enter: "{ENTER}",
      return: "{ENTER}",
      delete: "{DELETE}",
      del: "{DELETE}",
      escape: "{ESC}",
      esc: "{ESC}",
      backspace: "{BACKSPACE}",
      bksp: "{BACKSPACE}",
      tab: "{TAB}",
      space: " ",
      home: "{HOME}",
      end: "{END}",
      insert: "{INSERT}",
      ins: "{INSERT}",
      pageup: "{PGUP}",
      pgup: "{PGUP}",
      pagedown: "{PGDN}",
      pgdn: "{PGDN}",
      up: "{UP}",
      down: "{DOWN}",
      left: "{LEFT}",
      right: "{RIGHT}",
      add: "{ADD}",
      plus: "{ADD}",
      subtract: "{SUBTRACT}",
      minus: "{SUBTRACT}",
      hyphen: "{SUBTRACT}",
      multiply: "{MULTIPLY}",
      nummultiply: "{MULTIPLY}",
      times: "{MULTIPLY}",
      divide: "{DIVIDE}",
      numdivide: "{DIVIDE}",
      decimal: "{DECIMAL}",
      numdecimal: "{DECIMAL}",
      separator: "{SEPARATOR}",
      num0: "{NUMPAD0}",
      num1: "{NUMPAD1}",
      num2: "{NUMPAD2}",
      num3: "{NUMPAD3}",
      num4: "{NUMPAD4}",
      num5: "{NUMPAD5}",
      num6: "{NUMPAD6}",
      num7: "{NUMPAD7}",
      num8: "{NUMPAD8}",
      num9: "{NUMPAD9}",
    };
    if (keyMap[lower]) return keyMap[lower];
    const parts = lower.split("+").filter(Boolean);
    if (parts.length > 1) {
      let modifiers = "";
      const keys: string[] = [];
      for (const part of parts) {
        if (part === "ctrl" || part === "control" || part === "^") modifiers += "^";
        else if (part === "alt" || part === "option" || part === "%") modifiers += "%";
        else if (part === "shift") modifiers += "+";
        else keys.push(part);
      }
      const key = keys.join("+");
      const mappedKey = keyMap[key] || (/^f([1-9]|1\d|2[0-4])$/.test(key) ? `{${key.toUpperCase()}}` : escapeSendKeysText(key));
      return `${modifiers}${mappedKey}`;
    }
    if (/^f([1-9]|1\d|2[0-4])$/.test(lower)) return `{${lower.toUpperCase()}}`;
    return raw.includes("{") || raw.startsWith("^") || raw.startsWith("%")
      ? raw
      : escapeSendKeysText(raw);
  };
  const tryParseFriendlyKeyChord = (value: unknown): { keyName: string; modifierNames: string[] } | null => {
    const raw = String(value ?? "").trim();
    if (!raw || raw.startsWith("^") || raw.startsWith("%") || raw.startsWith("+") || raw.includes("{")) {
      return null;
    }
    const parts = raw.toLowerCase().replace(/\s+/g, "").split("+").filter(Boolean);
    if (parts.length === 0) return null;
    const modifierNames: string[] = [];
    const keyParts: string[] = [];
    for (const part of parts) {
      if (part === "ctrl" || part === "control") modifierNames.push("ctrl");
      else if (part === "alt" || part === "option") modifierNames.push("alt");
      else if (part === "shift") modifierNames.push("shift");
      else if (part === "win" || part === "leftwin" || part === "rightwin") modifierNames.push("win");
      else keyParts.push(part);
    }
    if (keyParts.length !== 1) return null;
    const keyName = normalizeVirtualKeyName(keyParts[0]);
    if (!keyName) return null;
    return {
      keyName,
      modifierNames: modifierNames.map((entry) => normalizeVirtualKeyName(entry)).filter(Boolean),
    };
  };
  const buildWindowsUnicodeTextHelper = () => [
    "$textSig = @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "[StructLayout(LayoutKind.Sequential)]",
    "public struct MOUSEINPUT {",
    "  public int dx;",
    "  public int dy;",
    "  public uint mouseData;",
    "  public uint dwFlags;",
    "  public uint time;",
    "  public IntPtr dwExtraInfo;",
    "}",
    "[StructLayout(LayoutKind.Sequential)]",
    "public struct KEYBDINPUT {",
    "  public ushort wVk;",
    "  public ushort wScan;",
    "  public uint dwFlags;",
    "  public uint time;",
    "  public IntPtr dwExtraInfo;",
    "}",
    "[StructLayout(LayoutKind.Sequential)]",
    "public struct HARDWAREINPUT {",
    "  public uint uMsg;",
    "  public ushort wParamL;",
    "  public ushort wParamH;",
    "}",
    "[StructLayout(LayoutKind.Explicit)]",
    "public struct INPUTUNION {",
    "  [FieldOffset(0)] public MOUSEINPUT mi;",
    "  [FieldOffset(0)] public KEYBDINPUT ki;",
    "  [FieldOffset(0)] public HARDWAREINPUT hi;",
    "}",
    "[StructLayout(LayoutKind.Sequential)]",
    "public struct INPUT {",
    "  public uint type;",
    "  public INPUTUNION U;",
    "}",
    "public static class TextInputApi {",
    "  [DllImport(\"user32.dll\", SetLastError = true)]",
    "  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);",
    "  [DllImport(\"user32.dll\", SetLastError = true)]",
    "  public static extern uint MapVirtualKey(uint uCode, uint uMapType);",
    "  public static uint SendUnicodeChar(char ch) {",
    "    var inputs = new INPUT[2];",
    "    inputs[0].type = 1;",
    "    inputs[0].U.ki.wVk = 0;",
    "    inputs[0].U.ki.wScan = ch;",
    "    inputs[0].U.ki.dwFlags = 0x0004;",
    "    inputs[1].type = 1;",
    "    inputs[1].U.ki.wVk = 0;",
    "    inputs[1].U.ki.wScan = ch;",
    "    inputs[1].U.ki.dwFlags = 0x0004 | 0x0002;",
    "    return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));",
    "  }",
    "  public static uint SendVirtualKey(ushort vk, bool keyUp, bool extendedKey) {",
    "    var inputs = new INPUT[1];",
    "    inputs[0].type = 1;",
    "    inputs[0].U.ki.wVk = vk;",
    "    inputs[0].U.ki.wScan = (ushort)MapVirtualKey(vk, 0);",
    "    inputs[0].U.ki.dwFlags = (keyUp ? 0x0002u : 0u) | (extendedKey ? 0x0001u : 0u);",
    "    return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));",
    "  }",
    "}",
    "'@;",
    "Add-Type $textSig",
    "function Send-UnicodeText([string]$value) {",
    "  if ($null -eq $value) { return }",
    "  foreach ($char in $value.ToCharArray()) {",
    "    $sentCount = [TextInputApi]::SendUnicodeChar([char]$char)",
    "    if ($sentCount -ne 2) { throw \"Unicode text dispatch failed for character '$char'.\" }",
    "    Start-Sleep -Milliseconds 5",
    "  }",
    "}",
  ];
  const buildWindowsVirtualKeyDispatchFunctions = () => [
    "function Resolve-KeyCode([string]$name) {",
    "  if (-not $name) { throw 'key is required.' }",
    "  try { return [byte](([System.Windows.Forms.Keys]::$name) -band 0xFF) }",
    "  catch { throw \"Unsupported key name '$name'.\" }",
    "}",
    "function Test-ExtendedKey([string]$name) {",
    "  switch ($name) {",
    "    'Insert' { return $true }",
    "    'Delete' { return $true }",
    "    'Home' { return $true }",
    "    'End' { return $true }",
    "    'PageUp' { return $true }",
    "    'PageDown' { return $true }",
    "    'Up' { return $true }",
    "    'Down' { return $true }",
    "    'Left' { return $true }",
    "    'Right' { return $true }",
    "    'LWin' { return $true }",
    "    'RWin' { return $true }",
    "    'Apps' { return $true }",
    "    'Divide' { return $true }",
    "    default { return $false }",
    "  }",
    "}",
    "function Send-KeyDown([string]$name, [byte]$code) {",
    "  $sent = [TextInputApi]::SendVirtualKey([uint16]$code, $false, (Test-ExtendedKey $name))",
    "  if ($sent -ne 1) { throw \"Virtual key down dispatch failed for '$name'.\" }",
    "}",
    "function Send-KeyUp([string]$name, [byte]$code) {",
    "  $sent = [TextInputApi]::SendVirtualKey([uint16]$code, $true, (Test-ExtendedKey $name))",
    "  if ($sent -ne 1) { throw \"Virtual key up dispatch failed for '$name'.\" }",
    "}",
    "function Send-FriendlyKeyPress([string]$keyName, [string[]]$modifierNames, [int]$repeatCount) {",
    "  $keyCode = Resolve-KeyCode $keyName",
    "  $modifierCodes = @($modifierNames | Where-Object { $_ } | ForEach-Object { Resolve-KeyCode $_ })",
    "  for ($m = 0; $m -lt $modifierCodes.Count; $m++) { Send-KeyDown $modifierNames[$m] $modifierCodes[$m]; Start-Sleep -Milliseconds 15 }",
    "  for ($i = 0; $i -lt $repeatCount; $i++) {",
    "    Send-KeyDown $keyName $keyCode",
    "    Start-Sleep -Milliseconds 15",
    "    Send-KeyUp $keyName $keyCode",
    "    if ($i -lt ($repeatCount - 1)) { Start-Sleep -Milliseconds 20 }",
    "  }",
    "  for ($i = $modifierCodes.Count - 1; $i -ge 0; $i--) { Send-KeyUp $modifierNames[$i] $modifierCodes[$i]; Start-Sleep -Milliseconds 15 }",
    "}",
  ];

tools.push(tool({
    name: "as_process_list",
    description: "List running processes, with optional filtering by process name or command line.",
    parameters: {
      query: z.string().default(""),
      include_command_line: z.boolean().default(false),
      limit: z.number().int().min(1).max(5000).default(200),
    },
    implementation: safeTool("as_process_list", async ({ query, include_command_line, limit }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const command = include_command_line ? "ps -axo pid=,comm=,args=" : "ps -axo pid=,comm=";
        const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
        const wanted = String(query || "").toLowerCase();
        const processes = (result.stdout || "")
          .split(/\r?\n/)
          .map((line: string) => line.match(/^\s*(\d+)\s+(\S+)\s*(.*)$/))
          .filter(Boolean)
          .map((match: RegExpMatchArray) => ({
            ProcessId: Number(match[1]),
            Name: match[2],
            CommandLine: include_command_line ? match[3] : undefined,
          }))
          .filter((entry: Record<string, unknown>) => !wanted || String(entry.Name || "").toLowerCase().includes(wanted) || String(entry.CommandLine || "").toLowerCase().includes(wanted))
          .slice(0, Number(limit));
        return json({ success: !result.error && result.exitCode === 0, processes, stderr: result.stderr, error: result.error });
      }
      const script = powerShellScript([
        `$query = ${escapeForPowerShellSingleQuoted(String(query || ""))}`,
        `$limit = ${Number(limit)}`,
        include_command_line
          ? "$items = Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath,CommandLine,CreationDate"
          : "$items = Get-Process | Select-Object Id,ProcessName,Path,StartTime",
        "if ($query) {",
        include_command_line
          ? "  $items = $items | Where-Object { ($_.Name -like \"*$query*\") -or ($_.ExecutablePath -like \"*$query*\") -or ($_.CommandLine -like \"*$query*\") }"
          : "  $items = $items | Where-Object { ($_.ProcessName -like \"*$query*\") -or ($_.Path -like \"*$query*\") }",
        "}",
        "$items = $items | Select-Object -First $limit",
        "$items | ConvertTo-Json -Compress -Depth 5",
      ]);
      const result = await runPowerShellScriptFile(script, "process-list");
      const parsed = result.stdout ? JSON.parse(result.stdout) : [];
      return json({ success: !result.error, processes: Array.isArray(parsed) ? parsed : [parsed], stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_process_details",
    description: "Get detailed information for a running process by PID.",
    parameters: {
      pid: z.number().int().min(0),
    },
    implementation: safeTool("as_process_details", async ({ pid }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const command = `ps -p ${Number(pid)} -o pid=,ppid=,comm=,args=`;
        const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
        const line = (result.stdout || "").split(/\r?\n/).find((entry: string) => entry.trim());
        const match = line?.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);
        return json({
          success: !result.error && result.exitCode === 0 && Boolean(match),
          process: match ? { ProcessId: Number(match[1]), ParentProcessId: Number(match[2]), Name: match[3], CommandLine: match[4] } : null,
          stderr: result.stderr,
          error: result.error,
        });
      }
      const script = powerShellScript([
        `$pidValue = ${Number(pid)}`,
        "$item = Get-CimInstance Win32_Process -Filter \"ProcessId = $pidValue\" | Select-Object ProcessId,Name,ExecutablePath,CommandLine,CreationDate,KernelModeTime,UserModeTime,WorkingSetSize",
        "if (-not $item) { throw 'Process not found.' }",
        "$item | ConvertTo-Json -Compress -Depth 5",
      ]);
      const result = await runPowerShellScriptFile(script, "process-details");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, process: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_process_kill",
    description: "Terminate a process by PID. Use carefully.",
    parameters: {
      pid: z.number().int().min(0),
      force: z.boolean().default(true),
      kill_related: z.boolean().default(true),
    },
    implementation: safeTool("as_process_kill", async ({ pid, force, kill_related }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const signal = force ? "SIGKILL" : "SIGTERM";
        try {
          process.kill(Number(pid), signal);
          return json({ success: true, pid, signal, killRelated: false, note: kill_related ? "kill_related is only implemented on Windows; only the requested PID was signaled." : null });
        } catch (error: any) {
          return json({ success: false, pid, signal, error: error?.message || String(error) });
        }
      }
      const script = powerShellScript([
        `$pidValue = ${Number(pid)}`,
        `$force = ${force ? "$true" : "$false"}`,
        `$killRelated = ${kill_related ? "$true" : "$false"}`,
        "$target = Get-CimInstance Win32_Process -Filter \"ProcessId = $pidValue\" | Select-Object ProcessId,Name,ExecutablePath,CommandLine,CreationDate",
        "if (-not $target) { throw 'Process not found.' }",
        "$killedRelated = @()",
        "$forceFlag = if ($force) { '/F' } else { '' }",
        "try {",
        "  taskkill /PID $pidValue /T $forceFlag | Out-Null",
        "} catch {",
        "  Stop-Process -Id $pidValue -ErrorAction Stop -Force:$force",
        "}",
        "if ($killRelated -and $target.ExecutablePath -and $target.ExecutablePath -like 'C:\\Program Files\\WindowsApps\\*') {",
        "  $related = Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $pidValue -and $_.Name -eq $target.Name -and $_.ExecutablePath -eq $target.ExecutablePath }",
        "  foreach ($item in $related) {",
        "    try {",
        "      taskkill /PID $($item.ProcessId) /T $forceFlag | Out-Null",
        "      $killedRelated += [pscustomobject]@{ pid = $item.ProcessId; name = $item.Name; executablePath = $item.ExecutablePath }",
        "    } catch {}",
        "  }",
        "}",
        "Start-Sleep -Milliseconds 750",
        "$stillRunning = @(Get-CimInstance Win32_Process -Filter \"ProcessId = $pidValue\")",
        "$relatedStillRunning = @()",
        "if ($killRelated -and $target.ExecutablePath -and $target.ExecutablePath -like 'C:\\Program Files\\WindowsApps\\*') {",
        "  $relatedStillRunning = @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $pidValue -and $_.Name -eq $target.Name -and $_.ExecutablePath -eq $target.ExecutablePath } | Select-Object ProcessId,Name,ExecutablePath,CommandLine,CreationDate)",
        "}",
        "[pscustomobject]@{",
        "  success = ($stillRunning.Count -eq 0) -and ($relatedStillRunning.Count -eq 0)",
        "  pid = $pidValue",
        "  force = $force",
        "  killRelated = $killRelated",
        "  target = $target",
        "  killedRelated = @($killedRelated)",
        "  stillRunning = @($stillRunning)",
        "  relatedStillRunning = @($relatedStillRunning)",
        "} | ConvertTo-Json -Compress -Depth 6",
      ]);
      const result = await runPowerShellScriptFile(script, "process-kill");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error && Boolean(parsed?.success), result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_kill_process_tree",
    description: "Terminate a process and any child processes in its process tree.",
    parameters: {
      pid: z.number().int().min(0),
      force: z.boolean().default(true),
    },
    implementation: safeTool("as_kill_process_tree", async ({ pid, force }) => {
      requireCommandExecution();
      const unsupported = process.platform === "win32" ? null : unsupportedOnPlatform("as_kill_process_tree", ["win32"]);
      if (unsupported) return unsupported;
      const script = powerShellScript([
        "$all = @(Get-CimInstance Win32_Process)",
        `$pidValue = ${Number(pid)}`,
        `$force = ${force ? "$true" : "$false"}`,
        "$forceFlag = if ($force) { '/F' } else { '' }",
        "$target = $all | Where-Object { $_.ProcessId -eq $pidValue } | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,CreationDate",
        "if (-not $target) { throw 'Process not found.' }",
        "$pending = New-Object System.Collections.Generic.Queue[int]",
        "$seen = New-Object System.Collections.Generic.HashSet[int]",
        "$descendants = @()",
        "$pending.Enqueue($pidValue)",
        "$null = $seen.Add($pidValue)",
        "while ($pending.Count -gt 0) {",
        "  $current = $pending.Dequeue()",
        "  $children = @($all | Where-Object { $_.ParentProcessId -eq $current })",
        "  foreach ($child in $children) {",
        "    if ($seen.Add([int]$child.ProcessId)) {",
        "      $pending.Enqueue([int]$child.ProcessId)",
        "      $descendants += [pscustomobject]@{ ProcessId = $child.ProcessId; ParentProcessId = $child.ParentProcessId; Name = $child.Name; ExecutablePath = $child.ExecutablePath; CommandLine = $child.CommandLine; CreationDate = $child.CreationDate }",
        "    }",
        "  }",
        "}",
        "try {",
        "  taskkill /PID $pidValue /T $forceFlag | Out-Null",
        "} catch {",
        "  Stop-Process -Id $pidValue -ErrorAction Stop -Force:$force",
        "  foreach ($child in ($descendants | Sort-Object ProcessId -Descending)) {",
        "    try { Stop-Process -Id $child.ProcessId -ErrorAction Stop -Force:$force } catch {}",
        "  }",
        "}",
        "Start-Sleep -Milliseconds 750",
        "$survivors = @()",
        "$aliveTarget = Get-CimInstance Win32_Process -Filter \"ProcessId = $pidValue\" | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,CreationDate",
        "if ($aliveTarget) { $survivors += $aliveTarget }",
        "foreach ($entry in @($descendants)) {",
        "  $alive = Get-CimInstance Win32_Process -Filter \"ProcessId = $($entry.ProcessId)\" | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,CreationDate",
        "  if ($alive) { $survivors += $alive }",
        "}",
        "[pscustomobject]@{",
        "  success = ($survivors.Count -eq 0)",
        "  pid = $pidValue",
        "  force = $force",
        "  target = $target",
        "  descendants = @($descendants)",
        "  survivors = @($survivors)",
        "} | ConvertTo-Json -Compress -Depth 6",
      ]);
      const result = await runPowerShellScriptFile(script, "process-kill-tree");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error && Boolean(parsed?.success), result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_process_start",
    description: "Start a local process with an optional working directory.",
    parameters: {
      command_line: z.string(),
      working_directory: z.string().default("."),
    },
    implementation: safeTool("as_process_start", async ({ command_line, working_directory }) => {
      requireCommandExecution();
      const cwd = resolveInsideWorkspace(workspaceRoot, working_directory as string);
      const result = await executeManagedCommand(ctl, command_line as string, { cwd, shell, env }, timeoutMs, maxOutputBytes);
      return buildCommandResponse(command_line as string, result);
    }),
  }));

tools.push(tool({
    name: "as_process_wait",
    description: "Wait until a process exits or the timeout elapses.",
    parameters: {
      pid: z.number().int().min(0),
      timeout_ms: z.number().int().min(1000).max(3600000).default(60000),
      poll_interval_ms: z.number().int().min(100).max(10000).default(1000),
    },
    implementation: safeTool("as_process_wait", async ({ pid, timeout_ms, poll_interval_ms }) => {
      const startedAt = Date.now();
      const processExists = () => {
        try {
          process.kill(Number(pid), 0);
          return true;
        } catch {
          return false;
        }
      };
      while (Date.now() - startedAt < Number(timeout_ms)) {
        if (!processExists()) {
          return json({ success: true, pid, exited: true, waitedMs: Date.now() - startedAt });
        }
        await new Promise((resolve) => setTimeout(resolve, Number(poll_interval_ms)));
      }
      return json({ success: false, pid, exited: !processExists(), waitedMs: Date.now() - startedAt, timedOut: true });
    }),
  }));

tools.push(tool({
    name: "as_port_list",
    description: "List listening or connected TCP ports and the owning process when available.",
    parameters: {
      port: z.number().int().min(1).max(65535).optional(),
      state: z.enum(["all", "listen", "established"]).default("all"),
      limit: z.number().int().min(1).max(5000).default(500),
    },
    implementation: safeTool("as_port_list", async ({ port, state, limit }) => {
      requireCommandExecution();
      if (process.platform === "win32") {
        const script = powerShellScript([
          `$targetPort = ${typeof port === "number" ? Number(port) : "$null"}`,
          `$limit = ${Number(limit)}`,
          "$items = Get-NetTCPConnection -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess",
          "if ($targetPort) { $items = $items | Where-Object { $_.LocalPort -eq $targetPort -or $_.RemotePort -eq $targetPort } }",
          state === "listen" ? "$items = $items | Where-Object { $_.State -eq 'Listen' }" : "",
          state === "established" ? "$items = $items | Where-Object { $_.State -eq 'Established' }" : "",
          "$items = $items | Select-Object -First $limit",
          "$items | ConvertTo-Json -Compress -Depth 5",
        ].filter(Boolean));
        const result = await runPowerShellScriptFile(script, "port-list");
        const parsed = result.stdout ? JSON.parse(result.stdout) : [];
        return json({ success: !result.error, items: Array.isArray(parsed) ? parsed : [parsed], stderr: result.stderr, error: result.error });
      }
      const command = process.platform === "darwin"
        ? "lsof -nP -iTCP"
        : "ss -tanp";
      const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
      return buildCommandResponse(command, result);
    }),
  }));

tools.push(tool({
    name: "as_port_wait",
    description: "Wait until a TCP port starts accepting connections.",
    parameters: {
      host: z.string().default("127.0.0.1"),
      port: z.number().int().min(1).max(65535),
      timeout_ms: z.number().int().min(1000).max(3600000).default(60000),
      poll_interval_ms: z.number().int().min(100).max(10000).default(1000),
    },
    implementation: safeTool("as_port_wait", async ({ host, port, timeout_ms, poll_interval_ms }) => {
      const net = await import("net");
      const startedAt = Date.now();
      const canConnect = async () => await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: String(host), port: Number(port) });
        const finish = (value: boolean) => {
          socket.removeAllListeners();
          socket.destroy();
          resolve(value);
        };
        socket.setTimeout(Math.min(Number(poll_interval_ms), 2000));
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));
      });
      while (Date.now() - startedAt < Number(timeout_ms)) {
        if (await canConnect()) {
          return json({ success: true, host, port, connected: true, waitedMs: Date.now() - startedAt });
        }
        await new Promise((resolve) => setTimeout(resolve, Number(poll_interval_ms)));
      }
      return json({ success: false, host, port, connected: false, waitedMs: Date.now() - startedAt, timedOut: true });
    }),
  }));

tools.push(tool({
    name: "as_env_list",
    description: "List environment variables visible to the plugin process, optionally filtered by name.",
    parameters: {
      query: z.string().default(""),
    },
    implementation: safeTool("as_env_list", async ({ query }) => {
      const wanted = String(query || "").toLowerCase();
      const entries = Object.entries(process.env)
        .filter(([key]) => !wanted || key.toLowerCase().includes(wanted))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ key, value: value ?? "" }));
      return json({ count: entries.length, entries });
    }),
  }));

tools.push(tool({
    name: "as_env_get",
    description: "Read a single environment variable value from the current process environment.",
    parameters: {
      name: z.string(),
    },
    implementation: safeTool("as_env_get", async ({ name }) => {
      return json({ name, value: process.env[String(name)] ?? null });
    }),
  }));

tools.push(tool({
    name: "as_env_set",
    description: "Set an environment variable for the current plugin process and child commands launched afterward.",
    parameters: {
      name: z.string(),
      value: z.string(),
    },
    implementation: safeTool("as_env_set", async ({ name, value }) => {
      process.env[String(name)] = String(value);
      return json({ success: true, name, value });
    }),
  }));

tools.push(tool({
    name: "as_env_refresh",
    description: "Refresh the plugin process environment from the OS so newly installed PATH tools become visible.",
    parameters: {},
    implementation: safeTool("as_env_refresh", async () => {
      if (process.platform !== "win32") {
        return json({ success: false, message: "as_env_refresh is currently only needed on Windows." });
      }
      const updates = await refreshProcessEnvironmentFromWindowsRegistry();
      const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") || "Path";
      return json({
        success: true,
        refreshedKeys: Object.keys(updates).sort(),
        pathKey,
        path: process.env[pathKey] || "",
      });
    }),
  }));

tools.push(tool({
    name: "as_file_open",
    description: "Open a local file or URL using the system default application.",
    parameters: {
      target: z.string(),
    },
    implementation: safeTool("as_file_open", async ({ target }) => {
      requireCommandExecution();
      const rawTarget = String(target);
      const resolvedTarget = /^[a-z]+:\/\//i.test(rawTarget)
        ? rawTarget
        : resolveInsideWorkspace(workspaceRoot, rawTarget);
      if (process.platform !== "win32") {
        const opener = process.platform === "darwin" ? "open" : "xdg-open";
        const command = `${opener} ${quote(resolvedTarget)}`;
        const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
        return buildCommandResponse(command, result);
      }
      const script = `Start-Process ${escapeForPowerShellSingleQuoted(resolvedTarget)}; @{ success = $true; target = ${escapeForPowerShellSingleQuoted(resolvedTarget)} } | ConvertTo-Json -Compress`;
      const result = await runPowerShellScriptFile(script, "file-open");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_service_list",
    description: "List Windows services with optional name filtering.",
    parameters: {
      query: z.string().default(""),
      limit: z.number().int().min(1).max(5000).default(200),
    },
    implementation: safeTool("as_service_list", async ({ query, limit }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_service_list");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        `$query = ${escapeForPowerShellSingleQuoted(String(query || ""))}`,
        "$items = Get-Service | Select-Object Name,DisplayName,Status,StartType",
        "if ($query) { $items = $items | Where-Object { $_.Name -like \"*$query*\" -or $_.DisplayName -like \"*$query*\" } }",
        `$items | Select-Object -First ${Number(limit)} | ConvertTo-Json -Compress -Depth 4`,
      ]);
      const result = await runPowerShellScriptFile(script, "service-list");
      const parsed = result.stdout ? JSON.parse(result.stdout) : [];
      return json({ success: !result.error, services: Array.isArray(parsed) ? parsed : [parsed], stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_service_control",
    description: "Start, stop, or restart a Windows service by name.",
    parameters: {
      service_name: z.string(),
      action: z.enum(["start", "stop", "restart"]),
    },
    implementation: safeTool("as_service_control", async ({ service_name, action }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_service_control");
      if (unsupported) return unsupported;
      const verb = action === "start" ? "Start-Service" : action === "stop" ? "Stop-Service" : "Restart-Service";
      const script = `${verb} -Name ${escapeForPowerShellSingleQuoted(service_name as string)} -ErrorAction Stop; @{ success = $true; service = ${escapeForPowerShellSingleQuoted(service_name as string)}; action = ${escapeForPowerShellSingleQuoted(action as string)} } | ConvertTo-Json -Compress`;
      const result = await runPowerShellScriptFile(script, "service-control");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_clipboard_read",
    description: "Inspect the Windows clipboard, including text, rich text, files, and images.",
    parameters: {
      save_image_to_path: z.string().default(""),
    },
    implementation: safeTool("as_clipboard_read", async ({ save_image_to_path }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_clipboard_read");
      if (unsupported) return unsupported;
      const imageOutputPath = String(save_image_to_path || "").trim()
        ? resolveInsideWorkspace(workspaceRoot, save_image_to_path as string)
        : "";
      if (imageOutputPath) {
        await fsp.mkdir(path.dirname(imageOutputPath), { recursive: true });
      }
      const script = powerShellScript([
        "Add-Type -AssemblyName System.Windows.Forms",
        "Add-Type -AssemblyName System.Drawing",
        "$result = [ordered]@{}",
        "$result.ContainsText = [Windows.Forms.Clipboard]::ContainsText()",
        "$result.ContainsHtml = [Windows.Forms.Clipboard]::ContainsText([Windows.Forms.TextDataFormat]::Html)",
        "$result.ContainsRtf = [Windows.Forms.Clipboard]::ContainsText([Windows.Forms.TextDataFormat]::Rtf)",
        "$result.ContainsFileDropList = [Windows.Forms.Clipboard]::ContainsFileDropList()",
        "$result.ContainsImage = [Windows.Forms.Clipboard]::ContainsImage()",
        "if ($result.ContainsText) { $result.Text = [Windows.Forms.Clipboard]::GetText() }",
        "if ($result.ContainsHtml) { $result.Html = [Windows.Forms.Clipboard]::GetText([Windows.Forms.TextDataFormat]::Html) }",
        "if ($result.ContainsRtf) { $result.Rtf = [Windows.Forms.Clipboard]::GetText([Windows.Forms.TextDataFormat]::Rtf) }",
        "if ($result.ContainsFileDropList) { $result.FileDropList = @([Windows.Forms.Clipboard]::GetFileDropList()) }",
        "if ($result.ContainsImage) {",
        "  $img = [Windows.Forms.Clipboard]::GetImage()",
        "  $result.Image = [ordered]@{ Width = $img.Width; Height = $img.Height }",
        imageOutputPath
          ? `  $img.Save(${escapeForPowerShellSingleQuoted(imageOutputPath)}, [System.Drawing.Imaging.ImageFormat]::Png); $result.Image.SavedTo = ${escapeForPowerShellSingleQuoted(imageOutputPath)}`
          : "  $result.Image.SavedTo = $null",
        "  $img.Dispose()",
        "}",
        "$result | ConvertTo-Json -Compress -Depth 6",
      ]);
      const result = await runPowerShellScriptFile(script, "clipboard-read");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, ...parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_clipboard_write",
    description: "Write text, HTML, RTF, a file list, or an image file to the Windows clipboard.",
    parameters: {
      mode: z.enum(["text", "html", "rtf", "files", "image"]).default("text"),
      text: z.string().default(""),
      file_paths_json: z.string().default("[]"),
      image_path: z.string().default(""),
    },
    implementation: safeTool("as_clipboard_write", async ({ mode, text, file_paths_json, image_path }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_clipboard_write");
      if (unsupported) return unsupported;
      let script = "";
      if (mode === "text") {
        script = `Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Clipboard]::SetText(${escapeForPowerShellSingleQuoted(text as string)}); @{ success = $true; mode = 'text' } | ConvertTo-Json -Compress`;
      } else if (mode === "html") {
        script = `Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Clipboard]::SetText(${escapeForPowerShellSingleQuoted(text as string)}, [Windows.Forms.TextDataFormat]::Html); @{ success = $true; mode = 'html' } | ConvertTo-Json -Compress`;
      } else if (mode === "rtf") {
        script = `Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.Clipboard]::SetText(${escapeForPowerShellSingleQuoted(text as string)}, [Windows.Forms.TextDataFormat]::Rtf); @{ success = $true; mode = 'rtf' } | ConvertTo-Json -Compress`;
      } else if (mode === "files") {
        const parsed = JSON.parse(file_paths_json as string);
        if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
          throw new Error("file_paths_json must be a JSON array of file paths.");
        }
        const fullPaths = parsed.map((entry) => resolveInsideWorkspace(workspaceRoot, entry));
        script = [
          "Add-Type -AssemblyName System.Windows.Forms",
          "$list = New-Object System.Collections.Specialized.StringCollection",
          ...fullPaths.map((entry) => `$list.Add(${escapeForPowerShellSingleQuoted(entry)}) | Out-Null`),
          "[Windows.Forms.Clipboard]::SetFileDropList($list)",
          "@{ success = $true; mode = 'files'; count = $list.Count } | ConvertTo-Json -Compress",
        ].join("; ");
      } else {
        const fullPath = resolveInsideWorkspace(workspaceRoot, image_path as string);
        script = [
          "Add-Type -AssemblyName System.Windows.Forms",
          "Add-Type -AssemblyName System.Drawing",
          `$img = [System.Drawing.Image]::FromFile(${escapeForPowerShellSingleQuoted(fullPath)})`,
          "[Windows.Forms.Clipboard]::SetImage($img)",
          "$img.Dispose()",
          "@{ success = $true; mode = 'image' } | ConvertTo-Json -Compress",
        ].join("; ");
      }
      const result = await runPowerShellScriptFile(script, "clipboard-write");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_screenshot_capture",
    description: "Capture a screenshot to a PNG file. Supports the current display, all displays, a specific monitor by index, or a specific window. Prefer source='window' with window_id when targeting a known app, especially because the window may be on a non-primary monitor. window_id may be a numeric window handle/id, a process id from as_window_controller list results, or a window title/process-name string, and the tool will try to resolve visible windows automatically. Use source='monitor' with monitor_index when you know the target display. Set include_cursor=true when a vision-guided workflow needs the pointer rendered into the image so the agent can see where it currently is. On supported OSes the tool tries to capture the window contents directly; otherwise it falls back as safely as possible. For multi-step desktop automation, call as_skill_recommend first and read the exact matching skill before acting; only skip that when no relevant skill matches or the user explicitly wants raw tool use. After capturing, remember to call as_file_embed with the returned path before you finish the screenshot-related task unless the user explicitly asked you not to embed the screenshot.",
    parameters: {
      output_path: z.string().default(""),
      source: z.enum(["current", "all", "monitor", "window", "region"]).default("current"),
      monitor_index: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      include_cursor: z.boolean().default(false),
      coordinate_space: z.enum(["screen", "window"]).default("screen"),
      x: z.number().int().default(0),
      y: z.number().int().default(0),
      width: z.number().int().min(1).default(1),
      height: z.number().int().min(1).default(1),
    },
    implementation: safeTool("as_screenshot_capture", async ({ output_path, source, monitor_index, window_id, include_cursor, coordinate_space, x, y, width, height }) => {
      requireCommandExecution();
      const configuredDirectory = getScreenshotDirectorySetting(ctl);
      const normalizedSource = String(source || "current").trim() || "current";
      const normalizedMonitorIndex = Math.max(0, Number(monitor_index) || 0);
      const normalizedCoordinateSpace = String(coordinate_space || "screen").trim() || "screen";
      const requestedWindowId = String(window_id || "").trim();
      let normalizedWindowId = requestedWindowId;
      const regionX = Math.trunc(Number(x) || 0);
      const regionY = Math.trunc(Number(y) || 0);
      const regionWidth = Math.max(1, Math.trunc(Number(width) || 1));
      const regionHeight = Math.max(1, Math.trunc(Number(height) || 1));
      const isTempLikeScreenshotPath = (candidate: string) => {
        const normalized = String(candidate || "").trim().replace(/\\/g, "/").toLowerCase();
        if (!normalized) return false;
        if (/^(\/)?tmp\//.test(normalized) || /^\/tmp\//.test(normalized)) return true;
        if (/^[a-z]:\/(temp|tmp)(\/|$)/.test(normalized)) return true;
        const osTemp = String(os.tmpdir?.() || "").replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
        return Boolean(osTemp) && (normalized === osTemp || normalized.startsWith(`${osTemp}/`));
      };
      const workspaceLocalScreenshotPath = (candidate: string, fallbackName: string) => {
        const raw = String(candidate || "").trim();
        if (!raw) return path.join("screenshots", fallbackName);
        if (isTempLikeScreenshotPath(raw)) {
          return path.join("screenshots", path.basename(raw) || fallbackName);
        }
        if (path.isAbsolute(raw)) {
          try {
            return path.relative(workspaceRoot, resolveInsideWorkspace(workspaceRoot, raw));
          } catch {
            return path.join("screenshots", path.basename(raw) || fallbackName);
          }
        }
        return raw;
      };
      const normalizedOutputPath = (() => {
        const fallbackName = `screenshot-${Date.now()}.png`;
        return workspaceLocalScreenshotPath(output_path as string, fallbackName);
      })();
      if (normalizedSource === "window" && !normalizedWindowId) {
        throw new Error("window_id is required when source='window'.");
      }
      if (normalizedSource === "region" && normalizedCoordinateSpace === "window" && !normalizedWindowId) {
        throw new Error("window_id is required when source='region' and coordinate_space='window'.");
      }
      const screenshotFollowup = {
        recommendedNextTool: "as_file_embed",
        recommendedSkillTool: "as_skill_recommend",
        guidance: "Unless the user said not to, embed the returned screenshot before you finish the screenshot task.",
        instruction: "Finish OCR or vision work first. Then call as_file_embed with the returned path before you conclude. For multi-step desktop work, read the matching skill first.",
        modelReminder: "Embed the screenshot after OCR or vision work, not before it blocks the current task.",
      };
      const resolveWindowIdentifier = async (requested: string) => {
        if (!requested) return null;
        if (process.platform === "win32" && /^\d+$/.test(requested)) {
          const script = powerShellScript([
            ...buildWindowsTopLevelWindowCatalogContext("WinApi", "items"),
            `$value = ${Number(requested)}`,
            "$pidMatch = @($items | Where-Object { $_.Id -eq $value })",
            "$handleMatch = @($items | Where-Object { [int64]$_.MainWindowHandle -eq $value })",
            "$match = $null",
            "$matchedBy = $null",
            "if ($handleMatch.Count -gt 0) { $match = $handleMatch | Select-Object -First 1; $matchedBy = 'window_handle' }",
            "elseif ($pidMatch.Count -gt 0) {",
            "  $proc = $null",
            "  try { $proc = Get-Process -Id $value -ErrorAction Stop } catch {}",
            "  $procTitle = if ($proc) { [string]$proc.MainWindowTitle } else { '' }",
            "  $match = $pidMatch | Sort-Object @{ Expression = { if (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) { 0 } else { 1 } } }, @{ Expression = { if ($procTitle -and $_.MainWindowTitle -eq $procTitle) { 0 } elseif ($procTitle -and $_.MainWindowTitle -like \"*$procTitle*\") { 1 } else { 2 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { [string]$_.MainWindowTitle } }, @{ Expression = { $_.MainWindowHandle } } | Select-Object -First 1",
            "  $matchedBy = 'process_id'",
            "}",
            "if (-not $match) { throw \"No visible window matched numeric target '$value'.\" }",
            "$proxy = $null",
            "if ($match.Path -like 'C:\\Program Files\\WindowsApps\\*' -or $match.ClassName -eq 'Windows.UI.Core.CoreWindow') {",
            "  $proxy = Resolve-HostProxyEntry $items $match ([int]$match.Id)",
            "}",
            "$matchUsable = Test-UsableWindowHandle([IntPtr]::new([long]$match.MainWindowHandle))",
            "$proxyUsable = $proxy -and (Test-UsableWindowHandle([IntPtr]::new([long]$proxy.MainWindowHandle)))",
            "$captureEntry = if ($proxyUsable) { $proxy } else { $null }",
            "if ($proxyUsable) { $resolvedEntry = $proxy } elseif ($matchUsable) { $resolvedEntry = $match } elseif ($proxy) { $resolvedEntry = $proxy } else { $resolvedEntry = $match }",
            "@{ requested = [string]$value; resolvedWindowId = [string]$resolvedEntry.MainWindowHandle; processId = $resolvedEntry.Id; processName = $resolvedEntry.ProcessName; title = $resolvedEntry.MainWindowTitle; path = $resolvedEntry.Path; className = $resolvedEntry.ClassName; sourceProcessId = $match.Id; sourceProcessName = $match.ProcessName; sourceWindowId = [string]$match.MainWindowHandle; candidateCount = if ($matchedBy -eq 'process_id') { $pidMatch.Count } else { $handleMatch.Count }; matchedBy = $matchedBy; captureProxyWindowId = if ($captureEntry) { [string]$captureEntry.MainWindowHandle } else { $null }; captureProxyProcessId = if ($captureEntry) { $captureEntry.Id } else { $null }; captureProxyProcessName = if ($captureEntry) { $captureEntry.ProcessName } else { $null }; captureProxyPath = if ($captureEntry) { $captureEntry.Path } else { $null }; captureProxyClassName = if ($captureEntry) { $captureEntry.ClassName } else { $null } } | ConvertTo-Json -Compress -Depth 5",
          ]);
          const result = await runPowerShellScriptFile(script, "resolve-window-numeric");
          if (result.error) throw new Error(compactCommandError(result.stderr, result.error, `No visible window matched '${requested}'.`));
          const parsed = result.stdout ? JSON.parse(result.stdout) : null;
          if (!parsed?.resolvedWindowId) throw new Error(`No visible window matched '${requested}'.`);
          return parsed;
        }
        if (process.platform === "darwin" && /^\d+$/.test(requested)) {
          return { requested, resolvedWindowId: requested, candidateCount: 1 };
        }
        if (process.platform === "linux" && /^(0x[0-9a-f]+|\d+)$/i.test(requested)) {
          return { requested, resolvedWindowId: requested, candidateCount: 1 };
        }
        if (process.platform === "win32") {
          const script = powerShellScript([
            ...buildWindowsTopLevelWindowCatalogContext("WinApi", "items"),
            `$query = ${escapeForPowerShellSingleQuoted(requested)}`,
            "$exact = @($items | Where-Object { $_.MainWindowTitle -eq $query -or $_.ProcessName -eq $query })",
            "if ($exact.Count -eq 0) { $exact = @($items | Where-Object { $_.MainWindowTitle -like \"*$query*\" -or $_.ProcessName -like \"*$query*\" }) }",
            "if ($exact.Count -eq 0) { throw \"No visible window matched '$query'.\" }",
            "$preferred = @($exact | Sort-Object @{ Expression = { if (Test-UsableWindowHandle([IntPtr]::new([long]$_.MainWindowHandle))) { 0 } else { 1 } } }, @{ Expression = { if ($_.ProcessName -match '^(ApplicationFrameHost|ShellExperienceHost|TextInputHost)$') { 1 } else { 0 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { if ($_.Path -like 'C:\\Windows\\system32\\*') { 1 } else { 0 } } }, @{ Expression = { $_.ProcessName } })",
            "$match = $preferred | Select-Object -First 1",
            "$proxy = $null",
            "if ($match.Path -like 'C:\\Program Files\\WindowsApps\\*' -or $match.ClassName -eq 'Windows.UI.Core.CoreWindow') {",
            "  $proxy = Resolve-HostProxyEntry $items $match ([int]$match.Id)",
            "}",
            "$matchUsable = Test-UsableWindowHandle([IntPtr]::new([long]$match.MainWindowHandle))",
            "$proxyUsable = $proxy -and (Test-UsableWindowHandle([IntPtr]::new([long]$proxy.MainWindowHandle)))",
            "$captureEntry = if ($proxyUsable) { $proxy } else { $null }",
            "if ($proxyUsable) { $resolvedEntry = $proxy } elseif ($matchUsable) { $resolvedEntry = $match } elseif ($proxy) { $resolvedEntry = $proxy } else { $resolvedEntry = $match }",
            "@{ requested = $query; resolvedWindowId = [string]$resolvedEntry.MainWindowHandle; processId = $resolvedEntry.Id; processName = $resolvedEntry.ProcessName; title = $resolvedEntry.MainWindowTitle; path = $resolvedEntry.Path; className = $resolvedEntry.ClassName; sourceProcessId = $match.Id; sourceProcessName = $match.ProcessName; sourceWindowId = [string]$match.MainWindowHandle; candidateCount = $exact.Count; matchedBy = 'query'; captureProxyWindowId = if ($captureEntry) { [string]$captureEntry.MainWindowHandle } else { $null }; captureProxyProcessId = if ($captureEntry) { $captureEntry.Id } else { $null }; captureProxyProcessName = if ($captureEntry) { $captureEntry.ProcessName } else { $null }; captureProxyPath = if ($captureEntry) { $captureEntry.Path } else { $null }; captureProxyClassName = if ($captureEntry) { $captureEntry.ClassName } else { $null }; candidatePreview = @($preferred | Select-Object -First 5 | ForEach-Object { [pscustomobject]@{ processId = $_.Id; processName = $_.ProcessName; title = $_.MainWindowTitle; resolvedWindowId = [string]$_.MainWindowHandle; path = $_.Path; className = $_.ClassName } }) } | ConvertTo-Json -Compress -Depth 6",
          ]);
          const result = await runPowerShellScriptFile(script, "resolve-window-query");
          if (result.error) throw new Error(result.stderr || result.error);
          const parsed = result.stdout ? JSON.parse(result.stdout) : null;
          if (!parsed?.resolvedWindowId) throw new Error(`No visible window matched '${requested}'.`);
          return parsed;
        }
        if (process.platform === "darwin") {
          const command = [
            "osascript",
            "-e",
            `"set q to ${requested.replace(/"/g, '\\"')}"`,
            "-e",
            "\"tell application \\\"System Events\\\"\"",
            "-e",
            "\"set matches to {}\"",
            "-e",
            "\"repeat with p in (application processes whose background only is false)\"",
            "-e",
            "\"set procName to name of p\"",
            "-e",
            "\"try\"",
            "-e",
            "\"repeat with w in windows of p\"",
            "-e",
            "\"set winName to name of w\"",
            "-e",
            "\"set winId to id of w\"",
            "-e",
            "\"if procName is q or winName is q or procName contains q or winName contains q then set end of matches to (procName & linefeed & winName & linefeed & (winId as string))\"",
            "-e",
            "\"end repeat\"",
            "-e",
            "\"end try\"",
            "-e",
            "\"end repeat\"",
            "-e",
            "\"if (count of matches) is 0 then error \\\"No visible window matched.\\\"\"",
            "-e",
            "\"return item 1 of matches\"",
          ].join(" ");
          const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
          if (result.error) throw new Error(result.stderr || result.error);
          const parts = String(result.stdout || "").trim().split(/\r?\n/);
          if (parts.length < 3) throw new Error(`No visible window matched '${requested}'.`);
          return {
            requested,
            processName: parts[0],
            title: parts[1],
            resolvedWindowId: parts[2],
            candidateCount: 1,
          };
        }
        if (process.platform === "linux") {
          const xdotoolCommand = `xdotool search --onlyvisible --name ${quote(requested)}`;
          const xdotoolResult = await executeManagedCommand(ctl, xdotoolCommand, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
          const xdotoolMatches = String(xdotoolResult.stdout || "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
          if (xdotoolMatches.length > 0) {
            return {
              requested,
              resolvedWindowId: xdotoolMatches[0],
              candidateCount: xdotoolMatches.length,
            };
          }
          const wmctrlCommand = `wmctrl -lx | grep -i ${quote(requested)}`;
          const wmctrlResult = await executeManagedCommand(ctl, wmctrlCommand, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
          const wmctrlLines = String(wmctrlResult.stdout || "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
          if (wmctrlLines.length > 0) {
            const first = wmctrlLines[0].split(/\s+/, 5);
            return {
              requested,
              resolvedWindowId: first[0],
              candidateCount: wmctrlLines.length,
              title: wmctrlLines[0],
            };
          }
          throw new Error(`No visible window matched '${requested}'.`);
        }
        return null;
      };
      let resolvedWindowInfo: Record<string, unknown> | null = null;
      const shouldResolveWindowIdentifier = (() => {
        if (!normalizedWindowId) return false;
        if (process.platform === "win32") return normalizedSource === "window" || (normalizedSource === "region" && normalizedCoordinateSpace === "window");
        if (process.platform === "darwin") return !/^\d+$/.test(normalizedWindowId);
        if (process.platform === "linux") return !/^(0x[0-9a-f]+|\d+)$/i.test(normalizedWindowId);
        return false;
      })();
      if (shouldResolveWindowIdentifier) {
        try {
          resolvedWindowInfo = await resolveWindowIdentifier(normalizedWindowId);
        } catch (error: any) {
          return json({
            success: false,
            requestedWindowId: requestedWindowId || normalizedWindowId || undefined,
            resolvedWindowId: undefined,
            error: compactCommandError("", error?.message || error, "Window capture failed."),
          });
        }
        normalizedWindowId = String(resolvedWindowInfo?.resolvedWindowId || "").trim();
      }
      let regionBoundsFromWindow: Record<string, number> | null = null;
      if (normalizedSource === "region" && normalizedCoordinateSpace === "window") {
        if (process.platform !== "win32") {
          throw new Error("source='region' with coordinate_space='window' is currently supported on Windows only.");
        }
        const regionWindowHandle = String(resolvedWindowInfo?.captureProxyWindowId || normalizedWindowId || "").trim();
        if (!/^\d+$/.test(regionWindowHandle)) {
          throw new Error("window_id must resolve to a numeric hWnd when coordinate_space='window' for region captures.");
        }
        const windowBoundsScript = powerShellScript([
          "$sig = @'",
          "using System;",
          "using System.Runtime.InteropServices;",
          "public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
          "public static class WinApi {",
          "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);",
          "  [DllImport(\"dwmapi.dll\")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);",
          "}",
          "'@",
          "Add-Type -TypeDefinition $sig",
          `$targetHandle = [IntPtr]::new([long]${escapeForPowerShellSingleQuoted(regionWindowHandle)})`,
          "$rect = New-Object RECT",
          "$dwmResult = [WinApi]::DwmGetWindowAttribute($targetHandle, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][RECT]))",
          "if ($dwmResult -ne 0) { [WinApi]::GetWindowRect($targetHandle, [ref]$rect) | Out-Null }",
          "@{ x = $rect.Left; y = $rect.Top; width = ($rect.Right - $rect.Left); height = ($rect.Bottom - $rect.Top) } | ConvertTo-Json -Compress",
        ]);
        const windowBoundsResult = await runPowerShellScriptFile(windowBoundsScript, "capture-region-bounds");
        const parsedWindowBounds = windowBoundsResult.stdout ? JSON.parse(windowBoundsResult.stdout) : null;
        if (!parsedWindowBounds || typeof parsedWindowBounds.x !== "number" || typeof parsedWindowBounds.y !== "number") {
          throw new Error("Unable to resolve window bounds for region capture.");
        }
        regionBoundsFromWindow = parsedWindowBounds;
      }
      const captureWindowId = process.platform === "win32" && normalizedSource === "window"
        ? String(resolvedWindowInfo?.captureProxyWindowId || normalizedWindowId || "").trim()
        : normalizedWindowId;
      const defaultScreenshotRelativePath = workspaceLocalScreenshotPath(
        configuredDirectory ? path.join(configuredDirectory, path.basename(normalizedOutputPath || `screenshot-${Date.now()}.png`)) : "",
        `screenshot-${Date.now()}.png`,
      );
      const screenshotPath = resolveInsideWorkspace(
        workspaceRoot,
        normalizedOutputPath || defaultScreenshotRelativePath,
      );
      const screenshotDirectory = path.dirname(screenshotPath);
      const screenshotDirectoryRoot = path.parse(screenshotDirectory).root;
      if (path.resolve(screenshotDirectory) !== path.resolve(screenshotDirectoryRoot)) {
        await fsp.mkdir(screenshotDirectory, { recursive: true });
      }
      if (process.platform !== "win32") {
        let command = "";
        let captureMethod = normalizedSource === "window" ? "direct_window" : normalizedSource === "monitor" ? "direct_monitor" : normalizedSource === "region" ? "direct_region" : "screen";
        const absoluteRegionX = normalizedCoordinateSpace === "window" && regionBoundsFromWindow ? regionBoundsFromWindow.x + regionX : regionX;
        const absoluteRegionY = normalizedCoordinateSpace === "window" && regionBoundsFromWindow ? regionBoundsFromWindow.y + regionY : regionY;
        if (process.platform === "darwin") {
          if (normalizedSource === "window") {
            command = `screencapture -x -l ${quote(normalizedWindowId)} ${quote(screenshotPath)}`;
          } else if (normalizedSource === "region") {
            command = `screencapture -x -R ${quote(`${absoluteRegionX},${absoluteRegionY},${regionWidth},${regionHeight}`)} ${quote(screenshotPath)}`;
          } else if (normalizedSource === "monitor") {
            command = `screencapture -x -D ${quote(String(normalizedMonitorIndex + 1))} ${quote(screenshotPath)}`;
          } else {
            command = `screencapture -x ${quote(screenshotPath)}`;
          }
        } else {
          if (normalizedSource === "window") {
            command = `(command -v import >/dev/null 2>&1 && import -window ${quote(normalizedWindowId)} ${quote(screenshotPath)})`;
          } else if (normalizedSource === "region") {
            command = `(command -v import >/dev/null 2>&1 && import -window root -crop ${quote(`${regionWidth}x${regionHeight}+${absoluteRegionX}+${absoluteRegionY}`)} ${quote(screenshotPath)})`;
          } else if (normalizedSource === "monitor") {
            const script = [
              "set -e",
              "if ! command -v xrandr >/dev/null 2>&1; then echo 'xrandr is required for monitor capture on Linux.' >&2; exit 1; fi",
              `monitor_index=${normalizedMonitorIndex}`,
              "$monLine=$(xrandr --listmonitors | tail -n +2 | sed -n \"$((monitor_index + 1))p\")",
              "if [ -z \"$monLine\" ]; then echo 'Requested monitor_index is out of range.' >&2; exit 1; fi",
              "geom=$(printf '%s' \"$monLine\" | sed -E 's/^.* ([0-9]+)\\/[^x]*x([0-9]+)\\/[^+]*\\+([0-9]+)\\+([0-9]+) .*$/\\1 \\2 \\3 \\4/')",
              "set -- $geom",
              "if [ $# -ne 4 ]; then echo 'Failed to parse monitor geometry from xrandr.' >&2; exit 1; fi",
              `if command -v import >/dev/null 2>&1; then import -window root -crop "$1x$2+$3+$4" ${quote(screenshotPath)}; else echo 'ImageMagick import is required for Linux monitor capture.' >&2; exit 1; fi`,
            ].join("; ");
            command = script;
          } else {
            command = `(command -v gnome-screenshot >/dev/null 2>&1 && gnome-screenshot -f ${quote(screenshotPath)}) || (command -v scrot >/dev/null 2>&1 && scrot ${quote(screenshotPath)}) || (command -v import >/dev/null 2>&1 && import -window root ${quote(screenshotPath)})`;
          }
        }
        const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const success = !result.error && result.exitCode === 0 && await fileExists(screenshotPath);
        if (!success && (normalizedSource === "window" || normalizedSource === "monitor") && process.platform === "linux") {
          return json({
            success: false,
            source: normalizedSource,
            monitorIndex: normalizedSource === "monitor" ? normalizedMonitorIndex : null,
            windowId: normalizedWindowId || null,
            requestedWindowId: resolvedWindowInfo ? requestedWindowId : undefined,
            resolvedWindow: resolvedWindowInfo || undefined,
            path: path.relative(workspaceRoot, screenshotPath),
            captureMethod,
            stderr: result.stderr,
            error: result.error || (normalizedSource === "monitor"
              ? "Direct Linux monitor capture failed. Install xrandr and ImageMagick 'import'."
              : "Direct Linux window capture failed. Install ImageMagick 'import' or use another supported direct window capture tool."),
            followup: screenshotFollowup,
          });
        }
        return json({
          success,
          source: normalizedSource,
          monitorIndex: normalizedSource === "monitor" ? normalizedMonitorIndex : null,
          windowId: normalizedWindowId || null,
          requestedWindowId: resolvedWindowInfo ? requestedWindowId : undefined,
          resolvedWindow: resolvedWindowInfo || undefined,
          path: path.relative(workspaceRoot, screenshotPath),
          captureMethod,
          stdout: result.stdout,
          stderr: result.stderr,
          error: result.error,
          followup: screenshotFollowup,
        });
      }
      if (normalizedSource === "window" && !/^\d+$/.test(captureWindowId)) {
        throw new Error("window_id must be a numeric hWnd on Windows.");
      }
      const script = powerShellScript([
        "Add-Type -AssemblyName System.Windows.Forms",
        "Add-Type -AssemblyName System.Drawing",
        "$sig = @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "public struct POINT { public int X; public int Y; }",
        "public struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT ptScreenPos; }",
        "public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
        "public static class WinApi {",
          "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);",
          "  [DllImport(\"user32.dll\")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);",
          "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
          "  [DllImport(\"user32.dll\")] public static extern IntPtr GetDC(IntPtr hWnd);",
          "  [DllImport(\"user32.dll\")] public static extern IntPtr GetWindowDC(IntPtr hWnd);",
          "  [DllImport(\"user32.dll\")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);",
          "  [DllImport(\"user32.dll\")] public static extern bool GetCursorPos(out POINT point);",
          "  [DllImport(\"user32.dll\")] public static extern bool GetCursorInfo(out CURSORINFO pci);",
          "  [DllImport(\"user32.dll\")] public static extern bool DrawIcon(IntPtr hDC, int X, int Y, IntPtr hIcon);",
          "  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);",
          "  [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
          "  [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);",
        "  [DllImport(\"user32.dll\", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);",
        "  [DllImport(\"gdi32.dll\", SetLastError=true)] public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int width, int height, IntPtr hdcSrc, int xSrc, int ySrc, int rop);",
        "  [DllImport(\"dwmapi.dll\")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);",
        "  public const int SRCCOPY = 0x00CC0020;",
        "  public const int CAPTUREBLT = 0x40000000;",
        "}",
        "'@",
        "Add-Type -TypeDefinition $sig",
        "$HWND_TOPMOST = [IntPtr]::new(-1)",
        "$HWND_NOTOPMOST = [IntPtr]::new(-2)",
        "$SWP_NOSIZE = 0x0001",
        "$SWP_NOMOVE = 0x0002",
        "$SWP_NOACTIVATE = 0x0010",
        "$SW_RESTORE = 9",
        "$CURSOR_SHOWING = 0x00000001",
        `$source = ${escapeForPowerShellSingleQuoted(normalizedSource)}`,
        `$monitorIndex = ${normalizedMonitorIndex}`,
        `$windowId = ${escapeForPowerShellSingleQuoted(normalizedWindowId)}`,
        `$captureWindowId = ${escapeForPowerShellSingleQuoted(captureWindowId)}`,
        `$includeCursor = ${include_cursor ? "$true" : "$false"}`,
        "if ($source -eq 'all') {",
        "  $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen",
        "} elseif ($source -eq 'monitor') {",
        "  $screens = [System.Windows.Forms.Screen]::AllScreens",
        "  if ($monitorIndex -lt 0 -or $monitorIndex -ge $screens.Length) { throw 'monitor_index is out of range.' }",
        "  $captureScreen = $screens[$monitorIndex]",
        "  $bounds = $captureScreen.Bounds",
        "} elseif ($source -eq 'region') {",
        `  $regionX = ${normalizedCoordinateSpace === "window" && regionBoundsFromWindow ? regionBoundsFromWindow.x + regionX : regionX}`,
        `  $regionY = ${normalizedCoordinateSpace === "window" && regionBoundsFromWindow ? regionBoundsFromWindow.y + regionY : regionY}`,
        `  $regionWidth = ${regionWidth}`,
        `  $regionHeight = ${regionHeight}`,
        "  $bounds = New-Object System.Drawing.Rectangle($regionX, $regionY, [Math]::Max(1, $regionWidth), [Math]::Max(1, $regionHeight))",
        "  $captureScreen = [System.Windows.Forms.Screen]::FromRectangle($bounds)",
        "} elseif ($source -eq 'window') {",
        "  $rect = New-Object RECT",
        "  $boundsHandle = if ($captureWindowId) { $captureWindowId } else { $windowId }",
        "  $hwnd = [IntPtr]::new([long]$boundsHandle)",
        "  $dwmResult = [WinApi]::DwmGetWindowAttribute($hwnd, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][RECT]))",
        "  if ($dwmResult -ne 0) {",
        "    $ok = [WinApi]::GetWindowRect($hwnd, [ref]$rect)",
        "    if (-not $ok) { throw 'Failed to resolve window bounds from hWnd.' }",
        "  }",
        "  $bounds = New-Object System.Drawing.Rectangle($rect.Left, $rect.Top, [Math]::Max(1, $rect.Right - $rect.Left), [Math]::Max(1, $rect.Bottom - $rect.Top))",
        "  $captureScreen = [System.Windows.Forms.Screen]::FromRectangle($bounds)",
        "} else {",
        "  $cursor = New-Object POINT",
        "  $cursorOk = [WinApi]::GetCursorPos([ref]$cursor)",
        "  if ($cursorOk) {",
        "    $captureScreen = [System.Windows.Forms.Screen]::FromPoint((New-Object System.Drawing.Point($cursor.X, $cursor.Y)))",
        "    $bounds = $captureScreen.Bounds",
        "  } else {",
        "    $captureScreen = [System.Windows.Forms.Screen]::PrimaryScreen",
        "    $bounds = $captureScreen.Bounds",
        "  }",
        "}",
        "function Test-MostlyBlackBitmap($bitmap) {",
        "  if (-not $bitmap) { return $true }",
        "  $xStep = [Math]::Max(1, [Math]::Floor($bitmap.Width / 12))",
        "  $yStep = [Math]::Max(1, [Math]::Floor($bitmap.Height / 12))",
        "  $samples = 0",
        "  $dark = 0",
        "  for ($x = 0; $x -lt $bitmap.Width; $x += $xStep) {",
        "    for ($y = 0; $y -lt $bitmap.Height; $y += $yStep) {",
        "      $pixel = $bitmap.GetPixel([Math]::Min($x, $bitmap.Width - 1), [Math]::Min($y, $bitmap.Height - 1))",
        "      $samples += 1",
        "      if (($pixel.R + $pixel.G + $pixel.B) -le 24) { $dark += 1 }",
        "    }",
        "  }",
        "  if ($samples -eq 0) { return $true }",
        "  return (($dark / $samples) -ge 0.97)",
        "}",
        "function Update-BoundsFromHandle([string]$targetHandle) {",
        "  $targetRect = New-Object RECT",
        "  $targetHwnd = [IntPtr]::new([long]$targetHandle)",
        "  $targetDwmResult = [WinApi]::DwmGetWindowAttribute($targetHwnd, 9, [ref]$targetRect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][RECT]))",
        "  if ($targetDwmResult -ne 0) {",
        "    $targetOk = [WinApi]::GetWindowRect($targetHwnd, [ref]$targetRect)",
        "    if (-not $targetOk) { throw 'Failed to resolve retry window bounds from hWnd.' }",
        "  }",
        "  $script:bounds = New-Object System.Drawing.Rectangle($targetRect.Left, $targetRect.Top, [Math]::Max(1, $targetRect.Right - $targetRect.Left), [Math]::Max(1, $targetRect.Bottom - $targetRect.Top))",
        "  $script:captureScreen = [System.Windows.Forms.Screen]::FromRectangle($script:bounds)",
        "}",
        "function Reset-CaptureSurface {",
        "  if ($script:graphics) { try { $script:graphics.Dispose() } catch {} }",
        "  if ($script:bitmap) { try { $script:bitmap.Dispose() } catch {} }",
        "  $script:bitmap = New-Object System.Drawing.Bitmap $script:bounds.Width, $script:bounds.Height",
        "  $script:graphics = [System.Drawing.Graphics]::FromImage($script:bitmap)",
        "}",
        "function Capture-FromScreenGdi([System.Drawing.Rectangle]$sourceRect) {",
        "  $targetGraphics = [System.Drawing.Graphics]::FromImage($script:bitmap)",
        "  $destHdc = [IntPtr]::Zero",
        "  $srcHdc = [IntPtr]::Zero",
        "  try {",
        "    $destHdc = $targetGraphics.GetHdc()",
        "    $srcHdc = [WinApi]::GetDC([IntPtr]::Zero)",
        "    if ($srcHdc -eq [IntPtr]::Zero) { return $false }",
        "    return [WinApi]::BitBlt($destHdc, 0, 0, $sourceRect.Width, $sourceRect.Height, $srcHdc, $sourceRect.X, $sourceRect.Y, ([WinApi]::SRCCOPY -bor [WinApi]::CAPTUREBLT))",
        "  } finally {",
        "    if ($srcHdc -ne [IntPtr]::Zero) { [WinApi]::ReleaseDC([IntPtr]::Zero, $srcHdc) | Out-Null }",
        "    if ($destHdc -ne [IntPtr]::Zero) { $targetGraphics.ReleaseHdc($destHdc) }",
        "    $targetGraphics.Dispose()",
        "  }",
        "}",
        "function Capture-FromWindowGdi([string]$targetHandle) {",
        "  if (-not $targetHandle) { return $false }",
        "  $hwnd = [IntPtr]::new([long]$targetHandle)",
        "  $targetGraphics = [System.Drawing.Graphics]::FromImage($script:bitmap)",
        "  $destHdc = [IntPtr]::Zero",
        "  $srcHdc = [IntPtr]::Zero",
        "  try {",
        "    $destHdc = $targetGraphics.GetHdc()",
        "    $srcHdc = [WinApi]::GetWindowDC($hwnd)",
        "    if ($srcHdc -eq [IntPtr]::Zero) { return $false }",
        "    return [WinApi]::BitBlt($destHdc, 0, 0, $script:bounds.Width, $script:bounds.Height, $srcHdc, 0, 0, ([WinApi]::SRCCOPY -bor [WinApi]::CAPTUREBLT))",
        "  } finally {",
        "    if ($srcHdc -ne [IntPtr]::Zero) { [WinApi]::ReleaseDC($hwnd, $srcHdc) | Out-Null }",
        "    if ($destHdc -ne [IntPtr]::Zero) { $targetGraphics.ReleaseHdc($destHdc) }",
        "    $targetGraphics.Dispose()",
        "  }",
        "}",
        "function Capture-FromCopyFromScreen([System.Drawing.Rectangle]$sourceRect) {",
        "  $script:graphics.CopyFromScreen($sourceRect.Location, [System.Drawing.Point]::Empty, $sourceRect.Size)",
        "  return $true",
        "}",
        "function Promote-WindowForCapture([string]$targetHandle) {",
        "  if (-not $targetHandle) { return $false }",
        "  $hwnd = [IntPtr]::new([long]$targetHandle)",
        "  try {",
        "    if ([WinApi]::IsIconic($hwnd)) { [WinApi]::ShowWindowAsync($hwnd, $SW_RESTORE) | Out-Null; Start-Sleep -Milliseconds 150 }",
        "    [WinApi]::SetWindowPos($hwnd, $HWND_TOPMOST, 0, 0, 0, 0, ($SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE)) | Out-Null",
        "    [WinApi]::SetForegroundWindow($hwnd) | Out-Null",
        "    Start-Sleep -Milliseconds 150",
        "    return $true",
        "  } catch {",
        "    return $false",
        "  }",
        "}",
        "function Restore-WindowPromotion([string]$targetHandle) {",
        "  if (-not $targetHandle) { return }",
        "  try {",
        "    $hwnd = [IntPtr]::new([long]$targetHandle)",
        "    [WinApi]::SetWindowPos($hwnd, $HWND_NOTOPMOST, 0, 0, 0, 0, ($SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE)) | Out-Null",
        "  } catch {}",
        "}",
        "$windowIdValue = if ($windowId) { $windowId } else { $null }",
        "$captureWindowIdValue = if ($captureWindowId) { $captureWindowId } else { $windowIdValue }",
        "if (-not $captureScreen) { $captureScreen = [System.Windows.Forms.Screen]::FromRectangle($bounds) }",
        "$bitmap = $null",
        "$graphics = $null",
        "$capturedDirect = $false",
        "$captureMethod = $null",
        "$blackRetryCount = 0",
        "$fallbackPromotedWindow = $false",
        "$attemptedMethods = New-Object 'System.Collections.Generic.List[string]'",
        "Reset-CaptureSurface",
        "if ($source -eq 'window') {",
        "  try {",
        "    $hwnd = [IntPtr]::new([long]$captureWindowId)",
        "    if ([WinApi]::IsIconic($hwnd)) { [WinApi]::ShowWindowAsync($hwnd, $SW_RESTORE) | Out-Null; Start-Sleep -Milliseconds 150 }",
        "    $hdc = $graphics.GetHdc()",
        "    try {",
        "      $capturedDirect = [WinApi]::PrintWindow($hwnd, $hdc, 2)",
        "      if (-not $capturedDirect) { $capturedDirect = [WinApi]::PrintWindow($hwnd, $hdc, 0) }",
        "    } finally {",
        "      $graphics.ReleaseHdc($hdc)",
        "    }",
        "  } catch {",
        "    $capturedDirect = $false",
        "  }",
        "}",
        "if ($capturedDirect) { $attemptedMethods.Add('print_window') | Out-Null }",
        "$capturedBlack = $capturedDirect -and (Test-MostlyBlackBitmap $bitmap)",
        "if ($capturedBlack) {",
        "  $capturedDirect = $false",
        "  Reset-CaptureSurface",
        "} elseif ($capturedDirect) {",
        "  $captureMethod = 'direct_window'",
        "}",
        "if (-not $captureMethod) {",
        "  if ($source -eq 'window') {",
        "    $attemptedMethods.Add('window_dc_gdi') | Out-Null",
        "    if ((Capture-FromWindowGdi $captureWindowIdValue) -and -not (Test-MostlyBlackBitmap $bitmap)) {",
        "      $captureMethod = 'window_dc_gdi'",
        "    } else {",
        "      Reset-CaptureSurface",
        "    }",
        "  } else {",
        "    $attemptedMethods.Add('screen_gdi') | Out-Null",
        "    if ((Capture-FromScreenGdi $bounds) -and -not (Test-MostlyBlackBitmap $bitmap)) {",
        "      $captureMethod = if ($source -eq 'monitor') { 'direct_monitor' } elseif ($source -eq 'region') { 'direct_region' } else { 'screen_gdi' }",
        "    } else {",
        "      Reset-CaptureSurface",
        "    }",
        "  }",
        "}",
        "$finalBlack = Test-MostlyBlackBitmap $bitmap",
        "if (-not $captureMethod) {",
        "  if ($source -eq 'window') {",
        "    $fallbackPromotedWindow = Promote-WindowForCapture $captureWindowIdValue",
        "    $attemptedMethods.Add('screen_gdi_promoted') | Out-Null",
        "    if ((Capture-FromScreenGdi $bounds) -and -not (Test-MostlyBlackBitmap $bitmap)) {",
        "      $captureMethod = 'screen_gdi_promoted'",
        "    } else {",
        "      Reset-CaptureSurface",
        "      $attemptedMethods.Add('copy_from_screen_promoted') | Out-Null",
        "      [void](Capture-FromCopyFromScreen $bounds)",
        "      if (-not (Test-MostlyBlackBitmap $bitmap)) { $captureMethod = 'screen_copyfromscreen_promoted' }",
        "    }",
        "    if ($fallbackPromotedWindow) { Restore-WindowPromotion $captureWindowIdValue }",
        "  } else {",
        "    $attemptedMethods.Add('copy_from_screen') | Out-Null",
        "    [void](Capture-FromCopyFromScreen $bounds)",
        "    if (-not (Test-MostlyBlackBitmap $bitmap)) {",
        "      $captureMethod = if ($source -eq 'monitor') { 'direct_monitor_copyfromscreen' } elseif ($source -eq 'region') { 'direct_region_copyfromscreen' } else { 'screen_copyfromscreen' }",
        "    }",
        "  }",
        "}",
        "$finalBlack = Test-MostlyBlackBitmap $bitmap",
        "if ($source -eq 'window' -and $finalBlack) {",
        "  $retryHandles = @()",
        "  if ($captureWindowIdValue) { $retryHandles += $captureWindowIdValue }",
        "  if ($windowIdValue -and $windowIdValue -ne $captureWindowIdValue) { $retryHandles += $windowIdValue }",
        "  foreach ($retryHandle in $retryHandles) {",
        "    try {",
        "      $blackRetryCount += 1",
        "      Update-BoundsFromHandle $retryHandle",
        "      Reset-CaptureSurface",
        "      $retryPromotedWindow = Promote-WindowForCapture $retryHandle",
        "      $attemptedMethods.Add(('retry_window_dc_gdi:' + [string]$retryHandle)) | Out-Null",
        "      $retrySuccess = $false",
        "      if ((Capture-FromWindowGdi $retryHandle) -and -not (Test-MostlyBlackBitmap $bitmap)) {",
        "        $captureMethod = 'retry_window_dc_gdi'",
        "        $retrySuccess = $true",
        "      } else {",
        "        Reset-CaptureSurface",
        "        $attemptedMethods.Add(('retry_screen_gdi:' + [string]$retryHandle)) | Out-Null",
        "        if ((Capture-FromScreenGdi $bounds) -and -not (Test-MostlyBlackBitmap $bitmap)) {",
        "          $captureMethod = 'retry_screen_gdi'",
        "          $retrySuccess = $true",
        "        } else {",
        "          Reset-CaptureSurface",
        "          $attemptedMethods.Add(('retry_copy_from_screen:' + [string]$retryHandle)) | Out-Null",
        "          [void](Capture-FromCopyFromScreen $bounds)",
        "          if (-not (Test-MostlyBlackBitmap $bitmap)) {",
        "            $captureMethod = 'retry_copyfromscreen'",
        "            $retrySuccess = $true",
        "          }",
        "        }",
        "      }",
        "      if ($retryPromotedWindow) { Restore-WindowPromotion $retryHandle }",
        "      $finalBlack = Test-MostlyBlackBitmap $bitmap",
        "      if ($retrySuccess -and -not $finalBlack) { $captureWindowIdValue = [string]$retryHandle; break }",
        "    } catch {}",
        "  }",
        "}",
        "if ($source -eq 'window' -and (($bounds.Height -lt 120) -or ($bounds.Width -lt 160))) {",
        "  try {",
        "    if ($windowIdValue -and $windowIdValue -ne $captureWindowIdValue) { Update-BoundsFromHandle $windowIdValue }",
        "    Reset-CaptureSurface",
        "    $retryTarget = if ($captureWindowIdValue) { $captureWindowIdValue } else { $windowIdValue }",
        "    $retryPromotedWindow = Promote-WindowForCapture $retryTarget",
        "    $attemptedMethods.Add(('small_bounds_retry:' + [string]$retryTarget)) | Out-Null",
        "    if ((Capture-FromScreenGdi $bounds) -and -not (Test-MostlyBlackBitmap $bitmap)) {",
        "      $captureMethod = 'small_bounds_retry_screen_gdi'",
        "    } else {",
        "      Reset-CaptureSurface",
        "      [void](Capture-FromCopyFromScreen $bounds)",
        "      if (-not (Test-MostlyBlackBitmap $bitmap)) { $captureMethod = 'small_bounds_retry_copyfromscreen' }",
        "    }",
        "    if ($retryPromotedWindow) { Restore-WindowPromotion $retryTarget }",
        "    $finalBlack = Test-MostlyBlackBitmap $bitmap",
        "  } catch {}",
        "}",
        "if (-not $captureMethod) {",
        "  $captureMethod = if ($finalBlack) { 'all_fallbacks_failed' } elseif ($source -eq 'monitor') { 'direct_monitor' } elseif ($source -eq 'region') { 'direct_region' } else { 'screen_fallback' }",
        "}",
        "$cursorInfo = New-Object CURSORINFO",
        "$cursorInfo.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][CURSORINFO])",
        "$cursorVisible = $false",
        "$cursorInsideCapture = $false",
        "$cursorRendered = $false",
        "$cursorScreenX = $null",
        "$cursorScreenY = $null",
        "$cursorRelativeX = $null",
        "$cursorRelativeY = $null",
        "try {",
        "  $cursorOk = [WinApi]::GetCursorInfo([ref]$cursorInfo)",
        "  if ($cursorOk) {",
        "    $cursorVisible = (($cursorInfo.flags -band $CURSOR_SHOWING) -ne 0)",
        "    $cursorScreenX = $cursorInfo.ptScreenPos.X",
        "    $cursorScreenY = $cursorInfo.ptScreenPos.Y",
        "    $cursorRelativeX = $cursorScreenX - $bounds.X",
        "    $cursorRelativeY = $cursorScreenY - $bounds.Y",
        "    $cursorInsideCapture = ($cursorRelativeX -ge 0 -and $cursorRelativeY -ge 0 -and $cursorRelativeX -lt $bounds.Width -and $cursorRelativeY -lt $bounds.Height)",
        "    if ($includeCursor -and $cursorVisible -and $cursorInsideCapture) {",
        "      $cursorHdc = $graphics.GetHdc()",
        "      try {",
        "        $cursorRendered = [WinApi]::DrawIcon($cursorHdc, [int]$cursorRelativeX, [int]$cursorRelativeY, $cursorInfo.hCursor)",
        "      } finally {",
        "        $graphics.ReleaseHdc($cursorHdc)",
        "      }",
        "    }",
        "  }",
        "} catch {}",
        `$path = ${escapeForPowerShellSingleQuoted(screenshotPath)}`,
        "$bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)",
        "$graphics.Dispose()",
        "$bitmap.Dispose()",
        "@{ success = $true; path = $path; source = $source; monitorIndex = if ($source -eq 'monitor') { $monitorIndex } else { $null }; coordinateSpace = if ($source -eq 'region') { " + escapeForPowerShellSingleQuoted(normalizedCoordinateSpace) + " } else { $null }; windowId = $windowIdValue; captureWindowId = $captureWindowIdValue; width = $bounds.Width; height = $bounds.Height; x = $bounds.X; y = $bounds.Y; capturedDirect = $capturedDirect; capturedBlack = $capturedBlack; finalBlack = $finalBlack; blackRetryCount = $blackRetryCount; fallbackPromotedWindow = $fallbackPromotedWindow; captureMethod = $captureMethod; attempts = @($attemptedMethods); region = if ($source -eq 'region') { @{ requested = @{ x = " + regionX + "; y = " + regionY + "; width = " + regionWidth + "; height = " + regionHeight + " }; absolute = @{ x = $bounds.X; y = $bounds.Y; width = $bounds.Width; height = $bounds.Height } } } else { $null }; cursor = @{ requested = $includeCursor; visible = $cursorVisible; rendered = $cursorRendered; insideCapture = $cursorInsideCapture; screen = if ($cursorScreenX -ne $null -and $cursorScreenY -ne $null) { @{ x = $cursorScreenX; y = $cursorScreenY } } else { $null }; relative = if ($cursorRelativeX -ne $null -and $cursorRelativeY -ne $null) { @{ x = $cursorRelativeX; y = $cursorRelativeY } } else { $null } }; monitor = @{ deviceName = $captureScreen.DeviceName; bounds = @{ x = $captureScreen.Bounds.X; y = $captureScreen.Bounds.Y; width = $captureScreen.Bounds.Width; height = $captureScreen.Bounds.Height }; workingArea = @{ x = $captureScreen.WorkingArea.X; y = $captureScreen.WorkingArea.Y; width = $captureScreen.WorkingArea.Width; height = $captureScreen.WorkingArea.Height }; primary = $captureScreen.Primary } } | ConvertTo-Json -Compress -Depth 8",
      ]);
      const result = await runPowerShellScriptFile(script, "capture");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const captureFileExists = await fileExists(screenshotPath);
      const captureCompletelyFailed = Boolean(parsed?.finalBlack) && String(parsed?.captureMethod || "") === "all_fallbacks_failed";
      const success = !result.error && captureFileExists && !captureCompletelyFailed;
      if (!success) {
        return json({
          success: false,
          requestedWindowId: resolvedWindowInfo ? requestedWindowId : normalizedWindowId || undefined,
          resolvedWindowId: String(parsed?.windowId || parsed?.captureWindowId || resolvedWindowInfo?.resolvedWindowId || normalizedWindowId || "").trim() || undefined,
          error: captureCompletelyFailed
            ? "Window capture remained fully black after all fallback attempts."
            : compactCommandError(result.stderr, result.error, "Window capture failed."),
        });
      }
      return json({
        success: true,
        path: path.relative(workspaceRoot, screenshotPath),
        requestedWindowId: resolvedWindowInfo ? requestedWindowId : undefined,
        resolvedWindow: resolvedWindowInfo || undefined,
        cursor: parsed?.cursor || undefined,
        windowRelativeCursor: parsed?.cursor?.relative || undefined,
        captureBounds: parsed ? { x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height } : undefined,
        result: parsed,
        followup: screenshotFollowup,
      });
    }),
  }));

tools.push(tool({
    name: "as_registry_list",
    description: "List Windows registry subkeys and values under a key path like HKCU\\Software or HKLM\\SOFTWARE.",
    parameters: {
      key_path: z.string(),
    },
    implementation: safeTool("as_registry_list", async ({ key_path }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_registry_list");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        `$path = ${escapeForPowerShellSingleQuoted(key_path as string)}`,
        "$item = Get-Item -Path Registry::$path -ErrorAction Stop",
        "$subkeys = @(Get-ChildItem -Path Registry::$path -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PSChildName)",
        "$props = Get-ItemProperty -Path Registry::$path -ErrorAction Stop",
        "$result = [ordered]@{ KeyPath = $path; Subkeys = $subkeys; Values = @{} }",
        "foreach ($prop in $props.PSObject.Properties) { if ($prop.Name -notmatch '^PS') { $result.Values[$prop.Name] = $prop.Value } }",
        "$result | ConvertTo-Json -Compress -Depth 8",
      ]);
      const result = await runPowerShellScriptFile(script, "registry-list");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, registry: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_registry_get_value",
    description: "Read a single Windows registry value.",
    parameters: {
      key_path: z.string(),
      value_name: z.string(),
    },
    implementation: safeTool("as_registry_get_value", async ({ key_path, value_name }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_registry_get_value");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        `$path = ${escapeForPowerShellSingleQuoted(key_path as string)}`,
        `$valueName = ${escapeForPowerShellSingleQuoted(value_name as string)}`,
        "$props = Get-ItemProperty -Path Registry::$path -ErrorAction Stop",
        "$value = $props.$valueName",
        "@{ KeyPath = $path; ValueName = $valueName; Value = $value } | ConvertTo-Json -Compress -Depth 8",
      ]);
      const result = await runPowerShellScriptFile(script, "registry-get");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, registryValue: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_registry_set_value",
    description: "Create or update a Windows registry value.",
    parameters: {
      key_path: z.string(),
      value_name: z.string(),
      value_type: z.enum(["String", "ExpandString", "Binary", "DWord", "QWord", "MultiString"]),
      value_json: z.string(),
      create_key_if_missing: z.boolean().default(true),
    },
    implementation: safeTool("as_registry_set_value", async ({ key_path, value_name, value_type, value_json, create_key_if_missing }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_registry_set_value");
      if (unsupported) return unsupported;
      const parsedValue = JSON.parse(value_json as string);
      const serialized = JSON.stringify(parsedValue);
      const script = powerShellScript([
        `$path = ${escapeForPowerShellSingleQuoted(key_path as string)}`,
        `$valueName = ${escapeForPowerShellSingleQuoted(value_name as string)}`,
        `$valueType = ${escapeForPowerShellSingleQuoted(value_type as string)}`,
        `$raw = ${escapeForPowerShellSingleQuoted(serialized)}`,
        `if (${create_key_if_missing ? "$true" : "$false"} -and -not (Test-Path Registry::$path)) { New-Item -Path Registry::$path -Force | Out-Null }`,
        "$value = ConvertFrom-Json -InputObject $raw",
        "if ($valueType -eq 'Binary' -and $value -is [System.Array]) { $value = [byte[]]$value }",
        "New-ItemProperty -Path Registry::$path -Name $valueName -Value $value -PropertyType $valueType -Force | Out-Null",
        "@{ success = $true; KeyPath = $path; ValueName = $valueName; ValueType = $valueType } | ConvertTo-Json -Compress",
      ]);
      const result = await runPowerShellScriptFile(script, "registry-set");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_registry_delete",
    description: "Delete a Windows registry value or key. Recursive key deletion requires confirmed=true.",
    parameters: {
      key_path: z.string(),
      value_name: z.string().default(""),
      recursive: z.boolean().default(false),
      confirmed: z.boolean().default(false),
    },
    implementation: safeTool("as_registry_delete", async ({ key_path, value_name, recursive, confirmed }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_registry_delete");
      if (unsupported) return unsupported;
      if (!(value_name as string).trim() && recursive && !confirmed) {
        return json({ success: false, requiresConfirmation: true, message: "Recursive key deletion requires confirmed=true." });
      }
      const script = powerShellScript([
        `$path = ${escapeForPowerShellSingleQuoted(key_path as string)}`,
        `$valueName = ${escapeForPowerShellSingleQuoted(value_name as string)}`,
        (value_name as string).trim()
          ? "Remove-ItemProperty -Path Registry::$path -Name $valueName -Force -ErrorAction Stop"
          : `Remove-Item -Path Registry::$path ${recursive ? "-Recurse" : ""} -Force -ErrorAction Stop`,
        (value_name as string).trim()
          ? "@{ success = $true; keyPath = $path; valueName = $valueName } | ConvertTo-Json -Compress"
          : `@{ success = $true; keyPath = $path; recursive = ${recursive ? "$true" : "$false"} } | ConvertTo-Json -Compress`,
      ]);
      const result = await runPowerShellScriptFile(script, "registry-delete");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_window_list",
    description: "List visible top-level application windows, including their current screen bounds and monitor placement when available. Use this before screenshotting when you need to understand which monitor a target window is on or where it is positioned on the desktop.",
    parameters: {
      query: z.string().default(""),
      limit: z.number().int().min(1).max(5000).default(200),
    },
    implementation: safeTool("as_window_list", async ({ query, limit }) => {
      requireCommandExecution();
      if (process.platform === "win32") {
        const script = powerShellScript([
          ...buildWindowsTopLevelWindowCatalogContext("WinApi", "allVisibleItems"),
          "Add-Type -AssemblyName System.Windows.Forms",
          `$query = ${escapeForPowerShellSingleQuoted(String(query || ""))}`,
          `$limit = ${Number(limit)}`,
          "$screens = [System.Windows.Forms.Screen]::AllScreens",
          "$queryLower = ([string]$query).Trim().ToLower()",
          "function Test-UsableRect($rect) {",
          "  $width = $rect.width",
          "  $height = $rect.height",
          "  if ($width -lt 120 -or $height -lt 120) { return $false }",
          "  if ($rect.x -le -30000 -and $rect.y -le -30000) { return $false }",
          "  return $true",
          "}",
          "function Get-QueryScore($item) {",
          "  if (-not $queryLower) { return 0 }",
          "  $title = ([string]$item.MainWindowTitle).Trim().ToLower()",
          "  $processName = ([string]$item.ProcessName).Trim().ToLower()",
          "  $path = ([string]$item.Path).Trim().ToLower()",
          "  $documentLikeTitle = ($title -split '\\s+' | Where-Object { $_ }).Count -ge 3 -and $title -match '[-:\\[\\]\\(\\)]'",
          "  $score = 0",
          "  if ($title -eq $queryLower) { $score -= 1000 }",
          "  elseif ($processName -eq $queryLower) { $score -= 900 }",
          "  elseif ($title.StartsWith($queryLower)) { $score -= 700 }",
          "  elseif ($processName.StartsWith($queryLower)) { $score -= 620 }",
          "  elseif ($title -split '\\s+' | Where-Object { $_ -eq $queryLower }) { $score -= 520 }",
          "  elseif ($title.Contains($queryLower)) { $score -= 320 }",
          "  elseif ($processName.Contains($queryLower)) { $score -= 240 }",
          "  if ($documentLikeTitle -and $processName -ne $queryLower -and -not $processName.StartsWith($queryLower)) { $score += 180 }",
          "  if ($processName -match '^(applicationframehost|shellexperiencehost|textinputhost)$') { $score += 80 }",
          "  if (([string]$item.ClassName).Trim().ToLower() -eq 'applicationframewindow') { $score += 20 }",
          "  if ($path.StartsWith('c:\\windows\\system32\\')) { $score += 25 }",
          "  return $score",
          "}",
          "$items = $allVisibleItems",
          "if ($query) { $items = $items | Where-Object { $_.ProcessName -like \"*$query*\" -or $_.MainWindowTitle -like \"*$query*\" } }",
          "if ($queryLower) {",
          "  $exactTitleMatches = @($items | Where-Object { ([string]$_.MainWindowTitle).Trim().ToLower() -eq $queryLower })",
          "  if ($exactTitleMatches.Count -gt 0) {",
          "    $items = @($items | Where-Object { ([string]$_.MainWindowTitle).Trim().ToLower() -eq $queryLower })",
          "  } else {",
          "    $exactProcessMatches = @($items | Where-Object { ([string]$_.ProcessName).Trim().ToLower() -eq $queryLower })",
          "    if ($exactProcessMatches.Count -gt 0) {",
          "      $items = @($items | Where-Object { ([string]$_.ProcessName).Trim().ToLower() -eq $queryLower })",
          "    }",
          "  }",
          "}",
          "$items = $items | Sort-Object @{ Expression = { Get-QueryScore $_ } }, @{ Expression = { if (Test-UsableRect $_.bounds) { 0 } else { 1 } } }, @{ Expression = { if ($_.ProcessName -match '^(ApplicationFrameHost|ShellExperienceHost|TextInputHost)$') { 1 } else { 0 } } }, @{ Expression = { if ($_.ClassName -eq 'ApplicationFrameWindow') { 0 } else { 1 } } }, @{ Expression = { if ($_.Path -like 'C:\\Windows\\system32\\*') { 1 } else { 0 } } }, @{ Expression = { $_.ProcessName } }, @{ Expression = { $_.Id } }",
          "$results = foreach ($item in $items) {",
          "  $proxy = $null",
          "  if (($item.Path -like 'C:\\Program Files\\WindowsApps\\*' -or $item.ClassName -eq 'Windows.UI.Core.CoreWindow') -and $item.MainWindowTitle) {",
          "    $proxy = Resolve-HostProxyEntry $allVisibleItems $item ([int]$item.Id)",
          "  }",
          "  $sourceUsable = Test-UsableRect $item.bounds",
          "  $proxyUsable = $proxy -and (Test-UsableRect $proxy.bounds)",
          "  if ($proxyUsable) { $resolvedItem = $proxy } elseif ($sourceUsable) { $resolvedItem = $item } elseif ($proxy) { $resolvedItem = $proxy } else { $resolvedItem = $item }",
          "  $rect = $resolvedItem.bounds",
          "  $width = [Math]::Max(0, [int]$rect.width)",
          "  $height = [Math]::Max(0, [int]$rect.height)",
          "  $bounds = New-Object System.Drawing.Rectangle([int]$rect.x, [int]$rect.y, [Math]::Max(1, $width), [Math]::Max(1, $height))",
          "  $screen = [System.Windows.Forms.Screen]::FromRectangle($bounds)",
          "  $monitorIndex = -1",
          "  for ($i = 0; $i -lt $screens.Length; $i++) { if ($screens[$i].DeviceName -eq $screen.DeviceName) { $monitorIndex = $i; break } }",
          "  [pscustomobject]@{",
          "    WindowId = [string]$resolvedItem.MainWindowHandle",
          "    ProcessId = $item.Id",
          "    SourceProcessId = $item.Id",
          "    ProcessName = $item.ProcessName",
          "    MainWindowTitle = $item.MainWindowTitle",
          "    MainWindowHandle = [string]$resolvedItem.MainWindowHandle",
          "    SourceMainWindowHandle = [string]$item.MainWindowHandle",
          "    Path = $item.Path",
          "    ClassName = $resolvedItem.ClassName",
          "    automationWindowId = if ($proxy) { [string]$proxy.MainWindowHandle } else { [string]$resolvedItem.MainWindowHandle }",
          "    automationProcessId = if ($proxy) { $proxy.Id } else { $resolvedItem.Id }",
          "    automationProcessName = if ($proxy) { $proxy.ProcessName } else { $resolvedItem.ProcessName }",
          "    automationPath = if ($proxy) { $proxy.Path } else { $resolvedItem.Path }",
          "    automationClassName = if ($proxy) { $proxy.ClassName } else { $resolvedItem.ClassName }",
          "    resolvedFrom = if ([string]$resolvedItem.MainWindowHandle -ne [string]$item.MainWindowHandle) { 'uwp_proxy' } else { 'self' }",
          "    bounds = @{ x = [int]$rect.x; y = [int]$rect.y; width = $width; height = $height }",
          "    monitorIndex = if ($monitorIndex -ge 0) { $monitorIndex } else { $null }",
          "    monitor = @{",
          "      deviceName = $screen.DeviceName",
          "      primary = $screen.Primary",
          "      bounds = @{ x = $screen.Bounds.X; y = $screen.Bounds.Y; width = $screen.Bounds.Width; height = $screen.Bounds.Height }",
          "      workingArea = @{ x = $screen.WorkingArea.X; y = $screen.WorkingArea.Y; width = $screen.WorkingArea.Width; height = $screen.WorkingArea.Height }",
          "    }",
          "  }",
          "}",
          "$results = @($results | Group-Object { if ($_.automationWindowId) { $_.automationWindowId } else { $_.MainWindowHandle } } | ForEach-Object { $_.Group | Sort-Object @{ Expression = { if ($_.ProcessName -match '^(ApplicationFrameHost|ShellExperienceHost|TextInputHost)$') { 1 } else { 0 } } }, @{ Expression = { if ($_.resolvedFrom -eq 'uwp_proxy') { 0 } elseif ($_.resolvedFrom -eq 'self') { 1 } else { 2 } } }, @{ Expression = { $_.ProcessId } } | Select-Object -First 1 })",
          "$results = @($results | Group-Object { ([string]$_.MainWindowTitle).Trim().ToLower() } | ForEach-Object {",
          "  $group = @($_.Group)",
          "  $nonHost = @($group | Where-Object { $_.ProcessName -notmatch '^(ApplicationFrameHost|ShellExperienceHost|TextInputHost)$' })",
          "  if ($nonHost.Count -gt 0) {",
          "    $nonHost | Sort-Object @{ Expression = { if ($_.resolvedFrom -eq 'uwp_proxy') { 0 } else { 1 } } }, @{ Expression = { $_.ProcessId } } | Select-Object -First 1",
          "  } else {",
          "    $group | Sort-Object @{ Expression = { if ($_.resolvedFrom -eq 'uwp_proxy') { 0 } elseif ($_.resolvedFrom -eq 'self') { 1 } else { 2 } } }, @{ Expression = { $_.ProcessId } } | Select-Object -First 1",
          "  }",
          "})",
          "$results = @($results | Select-Object -First $limit)",
          "$results | ConvertTo-Json -Compress -Depth 6",
        ]);
        const result = await runPowerShellScriptFile(script, "window-list");
        const parsed = result.stdout ? JSON.parse(result.stdout) : [];
        if (result.error) return json({ success: false, windows: [], error: compactCommandError(result.stderr, result.error, "Window listing failed.") });
        return json({ success: true, windows: Array.isArray(parsed) ? parsed : [parsed] });
      }
      if (process.platform === "darwin") {
        const screensCommand = [
          "osascript",
          "-l",
          "JavaScript",
          "-e",
          quote(`ObjC.import('AppKit');
const screens = ObjC.deepUnwrap($.NSScreen.screens).map((screen, index) => {
  const frame = ObjC.deepUnwrap(screen.frame);
  const visibleFrame = ObjC.deepUnwrap(screen.visibleFrame);
  return {
    monitorIndex: index,
    deviceName: null,
    primary: index === 0,
    bounds: { x: frame.origin.x, y: frame.origin.y, width: frame.size.width, height: frame.size.height },
    workingArea: { x: visibleFrame.origin.x, y: visibleFrame.origin.y, width: visibleFrame.size.width, height: visibleFrame.size.height },
  };
});
JSON.stringify(screens);`),
        ].join(" ");
        const screensResult = await executeManagedCommand(ctl, screensCommand, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const screens = screensResult.stdout ? JSON.parse(String(screensResult.stdout || "[]")) : [];
        const command = [
          "osascript",
          "-e",
          `"set q to ${String(query || "").replace(/"/g, '\\"')}"`,
          "-e",
          "\"tell application \\\"System Events\\\"\"",
          "-e",
          "\"set output to {}\"",
          "-e",
          "\"repeat with p in (application processes whose background only is false)\"",
          "-e",
          "\"set procName to name of p\"",
          "-e",
          "\"repeat with w in windows of p\"",
          "-e",
          "\"set winName to name of w\"",
          "-e",
          "\"if q is \\\"\\\" or procName contains q or winName contains q then\"",
          "-e",
          "\"set winPos to position of w\"",
          "-e",
          "\"set winSize to size of w\"",
          "-e",
          "\"set end of output to (procName & tab & winName & tab & (item 1 of winPos) & tab & (item 2 of winPos) & tab & (item 1 of winSize) & tab & (item 2 of winSize))\"",
          "-e",
          "\"end if\"",
          "-e",
          "\"end repeat\"",
          "-e",
          "\"end repeat\"",
          "-e",
          `"if (count of output) > ${Number(limit)} then set output to items 1 thru ${Number(limit)} of output"`,
          "-e",
          "\"return output as string\"",
          "-e",
          "\"end tell\"",
        ].join(" ");
        const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const windows = String(result.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
          const parts = line.split("\t");
          const bounds = {
            x: Number(parts[2] || 0),
            y: Number(parts[3] || 0),
            width: Number(parts[4] || 0),
            height: Number(parts[5] || 0),
          };
          const centerX = bounds.x + Math.max(0, bounds.width / 2);
          const centerY = bounds.y + Math.max(0, bounds.height / 2);
          const monitor = Array.isArray(screens)
            ? screens.find((screen: any) =>
              centerX >= Number(screen?.bounds?.x ?? 0)
              && centerX < Number(screen?.bounds?.x ?? 0) + Number(screen?.bounds?.width ?? 0)
              && centerY >= Number(screen?.bounds?.y ?? 0)
              && centerY < Number(screen?.bounds?.y ?? 0) + Number(screen?.bounds?.height ?? 0))
            : null;
          return {
            ProcessName: parts[0] || null,
            MainWindowTitle: parts[1] || null,
            bounds,
            monitorIndex: typeof monitor?.monitorIndex === "number" ? monitor.monitorIndex : null,
            monitor: monitor || null,
          };
        });
        return json({ success: !result.error, windows, stderr: result.stderr, error: result.error });
      }
      if (process.platform === "linux") {
        const monitorsResult = await executeManagedCommand(
          ctl,
          "xrandr --listmonitors",
          { cwd: workspaceRoot, shell, env },
          Math.max(timeoutMs, 120000),
          maxOutputBytes,
        );
        const monitors = String(monitorsResult.stdout || "")
          .split(/\r?\n/)
          .slice(1)
          .map((line: string, index: number) => {
            const match = line.trim().match(/^\d+:\s+(\+?\*?)([^\s]*)\s+(\d+)\/\d+x(\d+)\/\d+\+(-?\d+)\+(-?\d+)\s+(.+)$/);
            if (!match) return null;
            return {
              monitorIndex: index,
              primary: match[1].includes("*"),
              bounds: {
                x: Number(match[5]),
                y: Number(match[6]),
                width: Number(match[3]),
                height: Number(match[4]),
              },
              deviceName: match[7].trim(),
            };
          })
          .filter(Boolean);
        const result = await executeManagedCommand(
          ctl,
          "wmctrl -lpGx",
          { cwd: workspaceRoot, shell, env },
          Math.max(timeoutMs, 120000),
          maxOutputBytes,
        );
        const wanted = String(query || "").trim().toLowerCase();
        const windows = String(result.stdout || "")
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => {
            const match = line.match(/^(\S+)\s+(\S+)\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);
            if (!match) return null;
            const bounds = { x: Number(match[4]), y: Number(match[5]), width: Number(match[6]), height: Number(match[7]) };
            const centerX = bounds.x + Math.max(0, bounds.width / 2);
            const centerY = bounds.y + Math.max(0, bounds.height / 2);
            const monitor = Array.isArray(monitors)
              ? monitors.find((screen: any) =>
                centerX >= Number(screen?.bounds?.x ?? 0)
                && centerX < Number(screen?.bounds?.x ?? 0) + Number(screen?.bounds?.width ?? 0)
                && centerY >= Number(screen?.bounds?.y ?? 0)
                && centerY < Number(screen?.bounds?.y ?? 0) + Number(screen?.bounds?.height ?? 0))
              : null;
            return {
              MainWindowHandle: match[1],
              desktop: Number(match[2]),
              ProcessId: Number(match[3]),
              bounds,
              host: match[8],
              wmClass: match[9],
              MainWindowTitle: match[10],
              ProcessName: match[9],
              monitorIndex: typeof monitor?.monitorIndex === "number" ? monitor.monitorIndex : null,
              monitor: monitor || null,
            };
          })
          .filter(Boolean)
          .filter((entry: any) => !wanted || String(entry.ProcessName || "").toLowerCase().includes(wanted) || String(entry.MainWindowTitle || "").toLowerCase().includes(wanted))
          .slice(0, Number(limit));
        return json({ success: !result.error, windows, stderr: result.stderr, error: result.error });
      }
      return unsupportedOnPlatform("as_window_list", ["win32", "darwin", "linux"]);
    }),
  }));

tools.push(tool({
    name: "as_window_get_foreground",
    description: "Get the current foreground window and owning process.",
    parameters: {},
    implementation: safeTool("as_window_get_foreground", async () => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_get_foreground");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        "$sig = @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "using System.Text;",
        "public static class WinApi {",
        "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
        "  [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);",
        "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);",
        "}",
        "'@;",
        "Add-Type $sig",
        "$handle = [WinApi]::GetForegroundWindow()",
        "$sb = New-Object System.Text.StringBuilder 1024",
        "[WinApi]::GetWindowText($handle, $sb, $sb.Capacity) | Out-Null",
        "$processId = 0",
        "[WinApi]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null",
        "$proc = Get-Process -Id $processId -ErrorAction SilentlyContinue",
        "@{ Handle = $handle.ToInt64(); Title = $sb.ToString(); ProcessId = $processId; ProcessName = if ($proc) { $proc.ProcessName } else { $null } } | ConvertTo-Json -Compress",
      ]);
      const result = await runPowerShellScriptFile(script, "window-focus");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, window: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_window_focus",
    description: "Bring a window to the foreground by PID or exact window handle.",
    parameters: {
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
    },
    implementation: safeTool("as_window_focus", async ({ pid, window_id }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_focus");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id }),
        "$titleBuilder = New-Object System.Text.StringBuilder 1024",
        "[WinApi]::GetWindowText($resolvedTargetHandle, $titleBuilder, $titleBuilder.Capacity) | Out-Null",
        "$resolvedTitle = $titleBuilder.ToString()",
        "$resolvedProcessName = $null",
        "$resolvedPath = $null",
        "if ($resolvedTargetPid -gt 0) {",
        "  try {",
        "    $resolvedProc = Get-Process -Id $resolvedTargetPid -ErrorAction Stop",
        "    $resolvedProcessName = $resolvedProc.ProcessName",
        "    $resolvedPath = $resolvedProc.Path",
        "  } catch {}",
        "}",
        "@{ success = $true; pid = $resolvedTargetPid; requestedPid = $targetPid; requestedWindowId = $targetWindowId; windowId = [string]$resolvedTargetHandle; title = $resolvedTitle; processName = $resolvedProcessName; path = $resolvedPath } | ConvertTo-Json -Compress",
      ]);
      const result = await runPowerShellScriptFile(script, "window-focus");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      if (result.error) return json({ success: false, error: compactCommandError(result.stderr, result.error, "Window focus failed.") });
      return json({ success: true, result: parsed });
    }),
  }));

tools.push(tool({
    name: "as_window_close",
    description: "Close a window gracefully by PID, with optional force-kill fallback.",
    parameters: {
      pid: z.number().int().min(0),
      force_if_needed: z.boolean().default(false),
    },
    implementation: safeTool("as_window_close", async ({ pid, force_if_needed }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_close");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        `$pidValue = ${Number(pid)}`,
        "$proc = Get-Process -Id $pidValue -ErrorAction Stop",
        "$closed = $proc.CloseMainWindow()",
        "if (-not $closed -and " + (force_if_needed ? "$true" : "$false") + ") { Stop-Process -Id $pidValue -Force; $closed = $true }",
        "@{ success = $closed; pid = $pidValue } | ConvertTo-Json -Compress",
      ]);
      const result = await runPowerShellScriptFile(script, "window-set-bounds");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_window_minimize",
    description: "Minimize or restore a window by PID.",
    parameters: {
      pid: z.number().int().min(0),
      action: z.enum(["minimize", "restore"]).default("minimize"),
    },
    implementation: safeTool("as_window_minimize", async ({ pid, action }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_minimize");
      if (unsupported) return unsupported;
      const showCode = action === "restore" ? 9 : 6;
      const script = powerShellScript([
        "$sig = @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "public static class WinApi {",
        "  [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
        "}",
        "'@;",
        "Add-Type $sig",
        ...buildWindowsResolvedWindowContext(Number(pid)),
        `[WinApi]::ShowWindowAsync($resolvedHandle, ${showCode}) | Out-Null`,
        `@{ success = $true; pid = $resolvedPid; requestedPid = $pidValue; windowId = [string]$resolvedHandle; action = ${escapeForPowerShellSingleQuoted(action as string)} } | ConvertTo-Json -Compress`,
      ]);
      const result = await runPowerShellScriptFile(script, "window-get-bounds");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_window_set_bounds",
    description: "Move and/or resize a window by PID.",
    parameters: {
      pid: z.number().int().min(0),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
    },
    implementation: safeTool("as_window_set_bounds", async ({ pid, x, y, width, height }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_set_bounds");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        "$sig = @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "public static class WinApi {",
        "  [DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int nWidth, int nHeight, bool bRepaint);",
        "}",
        "'@;",
        "Add-Type $sig",
        ...buildWindowsResolvedWindowContext(Number(pid)),
        `$newX = ${typeof x === "number" ? Number(x) : "$resolvedRect.Left"}`,
        `$newY = ${typeof y === "number" ? Number(y) : "$resolvedRect.Top"}`,
        `$newWidth = ${typeof width === "number" ? Number(width) : "($resolvedRect.Right - $resolvedRect.Left)"}`,
        `$newHeight = ${typeof height === "number" ? Number(height) : "($resolvedRect.Bottom - $resolvedRect.Top)"}`,
        "[WinApi]::MoveWindow($resolvedHandle, $newX, $newY, $newWidth, $newHeight, $true) | Out-Null",
        "@{ success = $true; pid = $resolvedPid; requestedPid = $pidValue; windowId = [string]$resolvedHandle; x = $newX; y = $newY; width = $newWidth; height = $newHeight } | ConvertTo-Json -Compress",
      ]);
      const result = await runPowerShellScriptFile(script, "window-maximize");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_window_get_bounds",
    description: "Get the current window bounds for a process by PID.",
    parameters: {
      pid: z.number().int().min(0),
    },
    implementation: safeTool("as_window_get_bounds", async ({ pid }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_get_bounds");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        ...buildWindowsResolvedWindowContext(Number(pid)),
        "@{ success = $true; pid = $resolvedPid; requestedPid = $pidValue; windowId = [string]$resolvedHandle; x = $resolvedRect.Left; y = $resolvedRect.Top; width = ($resolvedRect.Right - $resolvedRect.Left); height = ($resolvedRect.Bottom - $resolvedRect.Top); title = $resolvedTitle; processName = $resolvedProcessName; path = $resolvedPath } | ConvertTo-Json -Compress",
      ]);
      const result = await runPowerShellScriptFile(script, "window-foreground");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_window_list_controls",
    description: "List Windows UI Automation controls inside a window by PID or exact window handle so agents can target named controls instead of guessing coordinates. name, automation_id, and control_type accept one string, a comma-separated list string, or a JSON array string; multiple values are matched with OR semantics so one call can fetch multiple known controls.",
    parameters: {
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      name: z.string().default(""),
      automation_id: z.string().default(""),
      control_type: z.string().default(""),
      include_offscreen: z.boolean().default(false),
      max_depth: z.number().int().min(1).max(12).default(8),
      limit: z.number().int().min(1).max(1000).default(200),
    },
    implementation: safeTool("as_window_list_controls", async ({ pid, window_id, name, automation_id, control_type, include_offscreen, max_depth, limit }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_list_controls");
      if (unsupported) return unsupported;
      const normalizeFilterList = (value: unknown) => {
        if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean);
        const raw = String(value || "").trim();
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean);
        } catch {}
        return raw.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
      };
      const nameFilters = normalizeFilterList(name);
      const automationIdFilters = normalizeFilterList(automation_id);
      const controlTypeFilters = normalizeFilterList(control_type);
      const script = powerShellScript([
        "Add-Type -AssemblyName UIAutomationClient",
        "Add-Type -AssemblyName UIAutomationTypes",
        ...buildWindowsInputGuard({ pid, windowId: window_id }),
        `$nameQueries = @(${nameFilters.map((entry) => escapeForPowerShellSingleQuoted(entry)).join(", ")})`,
        `$automationIdQueries = @(${automationIdFilters.map((entry) => escapeForPowerShellSingleQuoted(entry)).join(", ")})`,
        `$controlTypeQueries = @(${controlTypeFilters.map((entry) => escapeForPowerShellSingleQuoted(entry)).join(", ")})`,
        `$includeOffscreen = ${include_offscreen ? "$true" : "$false"}`,
        `$requestedMaxDepth = ${Math.max(1, Number(max_depth) || 8)}`,
        "$maxDepth = $requestedMaxDepth",
        `$limit = ${Math.max(1, Number(limit) || 200)}`,
        "$root = [System.Windows.Automation.AutomationElement]::FromHandle($resolvedTargetHandle)",
        "if (-not $root) { throw 'Unable to resolve a UI Automation root element for the window.' }",
        "function Convert-Bounds($rect) {",
        "  if (-not $rect) { return $null }",
        "  return @{ x = [int][Math]::Round($rect.Left); y = [int][Math]::Round($rect.Top); width = [int][Math]::Round($rect.Width); height = [int][Math]::Round($rect.Height) }",
        "}",
        "$rootRect = Get-ResolvedRect $resolvedTargetHandle",
        "$rootBounds = Convert-Bounds $rootRect",
        "function Convert-RelativeBounds($rect, $rootRectValue) {",
        "  if (-not $rect -or -not $rootRectValue) { return $null }",
        "  $absolute = Convert-Bounds $rect",
        "  if (-not $absolute) { return $null }",
        "  return @{ x = [int]($absolute.x - $rootRectValue.Left); y = [int]($absolute.y - $rootRectValue.Top); width = [int]$absolute.width; height = [int]$absolute.height }",
        "}",
        "function Convert-Center($boundsValue) {",
        "  if (-not $boundsValue) { return $null }",
        "  return @{ x = [int]($boundsValue.x + [Math]::Floor($boundsValue.width / 2)); y = [int]($boundsValue.y + [Math]::Floor($boundsValue.height / 2)) }",
        "}",
        "function Match-AnyContains($value, $queries) {",
        "  if ($queries.Count -eq 0) { return $true }",
        "  $haystack = ([string]$value).ToLower()",
        "  foreach ($query in $queries) { if ($query -and $haystack.Contains([string]$query)) { return $true } }",
        "  return $false",
        "}",
        "function Get-Win32ControlType([string]$className) {",
        "  $lower = ([string]$className).ToLower()",
        "  if ($lower -eq 'button') { return 'Button' }",
        "  if ($lower -eq 'edit') { return 'Edit' }",
        "  if ($lower -eq 'combobox') { return 'ComboBox' }",
        "  if ($lower -eq 'static') { return 'Text' }",
        "  if ($lower.Contains('trackbar')) { return 'Slider' }",
        "  if ($lower.Contains('scrollbar')) { return 'ScrollBar' }",
        "  if ($lower.Contains('listview')) { return 'ListView' }",
        "  if ($lower.Contains('treeview')) { return 'TreeView' }",
        "  if ($lower.Contains('toolbar')) { return 'ToolBar' }",
        "  if ($lower.Contains('statusbar')) { return 'StatusBar' }",
        "  if ($lower.Contains('richedit')) { return 'RichEdit' }",
        "  if ($lower.Contains('directui')) { return 'DirectUI' }",
        "  if ($lower.Contains('afx:')) { return 'MfcWindow' }",
        "  if ($lower) { return 'CustomWindow' }",
        "  return 'Window'",
        "}",
        "function Match-Control($entry) {",
        "  $ok = $true",
        "  $ok = $ok -and (Match-AnyContains $entry.name $nameQueries)",
        "  $ok = $ok -and (Match-AnyContains $entry.automationId $automationIdQueries)",
        "  if ($controlTypeQueries.Count -gt 0) {",
        "    $controlTypeOk = (Match-AnyContains $entry.controlType $controlTypeQueries) -or (Match-AnyContains $entry.localizedControlType $controlTypeQueries) -or (Match-AnyContains $entry.className $controlTypeQueries)",
        "    $ok = $ok -and $controlTypeOk",
        "  }",
        "  if (-not $includeOffscreen -and $entry.isOffscreen) { $ok = $false }",
        "  return $ok",
        "}",
        "$queue = New-Object 'System.Collections.Generic.Queue[object]'",
        "$queue.Enqueue([pscustomobject]@{ element = $root; depth = 0 })",
        "$uiAutomationResults = New-Object 'System.Collections.Generic.List[object]'",
        "while ($queue.Count -gt 0 -and $uiAutomationResults.Count -lt $limit) {",
        "  $node = $queue.Dequeue()",
        "  $element = $node.element",
        "  $depth = [int]$node.depth",
        "  if ($depth -gt 0) {",
        "    try {",
        "      $current = $element.Current",
        "      $supportedPatterns = @($element.GetSupportedPatterns() | ForEach-Object { try { $_.ProgrammaticName } catch { $null } } | Where-Object { $_ })",
        "      $bounds = Convert-Bounds $current.BoundingRectangle",
        "      $windowRelativeBounds = Convert-RelativeBounds $current.BoundingRectangle $rootRect",
        "      $entry = [pscustomobject]@{",
        "        source = 'uia'",
        "        depth = $depth",
        "        name = [string]$current.Name",
        "        automationId = [string]$current.AutomationId",
        "        className = [string]$current.ClassName",
        "        localizedControlType = [string]$current.LocalizedControlType",
        "        controlType = if ($current.ControlType) { [string]$current.ControlType.ProgrammaticName } else { '' }",
        "        frameworkId = [string]$current.FrameworkId",
        "        processId = [int]$current.ProcessId",
        "        isEnabled = [bool]$current.IsEnabled",
        "        isOffscreen = [bool]$current.IsOffscreen",
        "        hasKeyboardFocus = [bool]$current.HasKeyboardFocus",
        "        nativeWindowHandle = [int]$current.NativeWindowHandle",
        "        bounds = $bounds",
        "        windowRelativeBounds = $windowRelativeBounds",
        "        center = Convert-Center $bounds",
        "        windowRelativeCenter = Convert-Center $windowRelativeBounds",
        "        supportedPatterns = $supportedPatterns",
        "      }",
        "      if (Match-Control $entry) { $uiAutomationResults.Add($entry) | Out-Null }",
        "    } catch {}",
        "  }",
        "  if ($depth -lt $maxDepth) {",
        "    try {",
        "      $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)",
        "      for ($i = 0; $i -lt $children.Count; $i++) {",
        "        $queue.Enqueue([pscustomobject]@{ element = $children.Item($i); depth = ($depth + 1) })",
        "      }",
        "    } catch {}",
        "  }",
        "}",
        "$win32RawResults = New-Object 'System.Collections.Generic.List[object]'",
        "$win32Callback = [WinApi+EnumChildWindowsProc]{",
        "  param($childHandle, $lParam)",
        "  try {",
        "    $titleBuilder = New-Object System.Text.StringBuilder 1024",
        "    [WinApi]::GetWindowText($childHandle, $titleBuilder, $titleBuilder.Capacity) | Out-Null",
        "    $classBuilder = New-Object System.Text.StringBuilder 512",
        "    [WinApi]::GetClassName($childHandle, $classBuilder, $classBuilder.Capacity) | Out-Null",
        "    $childRect = Get-ResolvedRect $childHandle",
        "    $bounds = Convert-Bounds $childRect",
        "    $windowRelativeBounds = Convert-RelativeBounds $childRect $rootRect",
        "    $className = $classBuilder.ToString()",
        "    $windowText = $titleBuilder.ToString()",
        "    $semanticType = Get-Win32ControlType $className",
        "    $entry = [pscustomobject]@{",
        "      source = 'win32'",
        "      name = if ($windowText) { $windowText } elseif ($className) { $className } else { [string]$childHandle.ToInt64() }",
        "      windowText = $windowText",
        "      automationId = ''",
        "      className = $className",
        "      localizedControlType = $semanticType",
        "      controlType = $semanticType",
        "      frameworkId = 'win32'",
        "      processId = [int]$resolvedTargetPid",
        "      isEnabled = [bool][WinApi]::IsWindowEnabled($childHandle)",
        "      isOffscreen = -not [bool][WinApi]::IsWindowVisible($childHandle)",
        "      hasKeyboardFocus = $false",
        "      nativeWindowHandle = [string]$childHandle.ToInt64()",
        "      parentWindowHandle = [string]([WinApi]::GetParent($childHandle).ToInt64())",
        "      controlId = [int][WinApi]::GetDlgCtrlID($childHandle)",
        "      bounds = $bounds",
        "      windowRelativeBounds = $windowRelativeBounds",
        "      center = Convert-Center $bounds",
        "      windowRelativeCenter = Convert-Center $windowRelativeBounds",
        "      supportedPatterns = @()",
        "      messageDispatchable = $true",
        "      messageHints = @()",
        "    }",
        "    if (Match-Control $entry) { $win32RawResults.Add($entry) | Out-Null }",
        "  } catch {}",
        "  return ($win32RawResults.Count -lt $limit)",
        "}",
        "[WinApi]::EnumChildWindows($resolvedTargetHandle, $win32Callback, [IntPtr]::Zero) | Out-Null",
        "$parentLookup = @{}",
        "foreach ($entry in @($win32RawResults | ForEach-Object { $_ })) {",
        "  $parentLookup[[string]$entry.nativeWindowHandle] = [string]$entry.parentWindowHandle",
        "}",
        "$rootHandleText = [string]$resolvedTargetHandle.ToInt64()",
        "function Get-ChildDepth([string]$handleText) {",
        "  if (-not $handleText) { return 1 }",
        "  $depth = 1",
        "  $current = $handleText",
        "  $guard = 0",
        "  while ($parentLookup.ContainsKey($current) -and $guard -lt 64) {",
        "    $parentText = [string]$parentLookup[$current]",
        "    if (-not $parentText -or $parentText -eq '0' -or $parentText -eq $rootHandleText) { break }",
        "    $current = $parentText",
        "    $depth++",
        "    $guard++",
        "  }",
        "  return $depth",
        "}",
        "$win32Controls = @($win32RawResults | Sort-Object @{ Expression = { $_.windowRelativeBounds.y } }, @{ Expression = { $_.windowRelativeBounds.x } }, @{ Expression = { $_.nativeWindowHandle } } | ForEach-Object {",
        "  $_ | Add-Member -NotePropertyName depth -NotePropertyValue (Get-ChildDepth([string]$_.nativeWindowHandle)) -Force",
        "  $_",
        "})",
        "$uiAutomationControls = @($uiAutomationResults | Sort-Object @{ Expression = { $_.depth } }, @{ Expression = { $_.windowRelativeBounds.y } }, @{ Expression = { $_.windowRelativeBounds.x } }, @{ Expression = { $_.nativeWindowHandle } })",
        "@{ success = $true; pid = $resolvedTargetPid; requestedPid = $targetPid; requestedWindowId = $targetWindowId; windowId = [string]$resolvedTargetHandle; searchDepthUsed = $maxDepth; invokeSuggestion = @{ max_depth = $maxDepth; note = 'Reuse this max_depth or a larger value with invoke_control when targeting one of these controls.' }; rootWindowBounds = $rootBounds; counts = @{ uiAutomation = $uiAutomationControls.Count; win32 = $win32Controls.Count; total = ($uiAutomationControls.Count + $win32Controls.Count) }; uiAutomationControls = $uiAutomationControls; win32Controls = $win32Controls } | ConvertTo-Json -Compress -Depth 8",
      ]);
      const result = await runPowerShellScriptFile(script, "window-controls");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const normalized = parsed && typeof parsed === "object"
        ? {
          ...parsed,
          uiAutomationControls: Array.isArray(parsed.uiAutomationControls) ? parsed.uiAutomationControls.map((entry: any) => normalizeDesktopControlRecord(entry)) : [],
          win32Controls: Array.isArray(parsed.win32Controls) ? parsed.win32Controls.map((entry: any) => normalizeDesktopControlRecord(entry)) : [],
        }
        : parsed;
      if (result.error) return json({ success: false, error: compactCommandError(result.stderr, result.error, "Control listing failed.") });
      if (normalized && typeof normalized === "object") {
        const combinedControls = [...(normalized.uiAutomationControls || []), ...(normalized.win32Controls || [])]
          .sort((left: any, right: any) => {
            const sourceOrder = (entry: any) => String(entry?.source || "").toLowerCase() === "uia" ? 0 : 1;
            return sourceOrder(left) - sourceOrder(right)
              || (Number(left?.depth) || 0) - (Number(right?.depth) || 0)
              || (Number(left?.windowRelativeBounds?.y) || Number(left?.bounds?.y) || 0) - (Number(right?.windowRelativeBounds?.y) || Number(right?.bounds?.y) || 0)
              || (Number(left?.windowRelativeBounds?.x) || Number(left?.bounds?.x) || 0) - (Number(right?.windowRelativeBounds?.x) || Number(right?.bounds?.x) || 0)
              || String(left?.nativeWindowHandle || "").localeCompare(String(right?.nativeWindowHandle || ""));
          })
          .slice(0, Math.max(1, Number(limit) || 200))
          .map((entry: any, index: number) => ({ ...entry, index: index + 1 }));
        const normalizedResult = {
          ...normalized,
          uiAutomationCount: Array.isArray(normalized.uiAutomationControls) ? normalized.uiAutomationControls.length : 0,
          win32Count: Array.isArray(normalized.win32Controls) ? normalized.win32Controls.length : 0,
          availableCount: combinedControls.length,
          count: combinedControls.length,
          controls: combinedControls,
        };
        if (normalizedResult.count === 0) {
          return json({
            success: true,
            result: {
              ...normalizedResult,
              controlDiscoveryHint: "No UI Automation controls or Win32 child windows were exposed for this window. The app may be fully custom-drawn. Use as_vision_target to locate sliders, buttons, icons, or labels by image/window-relative coordinates, then verify with a fresh screenshot.",
            },
          });
        }
        return json({
          success: true,
          result: {
            ...normalizedResult,
            controlDiscoveryHint: normalizedResult.uiAutomationCount === 0 && normalizedResult.win32Count > 0
              ? "UI Automation controls were unavailable, but Win32 child-window controls were discovered. Use their nativeWindowHandle, windowRelativeBounds, and messageHints with action='send_message' or coordinate input tools."
              : normalizedResult.uiAutomationCount > 0 && normalizedResult.win32Count > 0
                ? "Both UI Automation controls and Win32 child-window controls were discovered. Prefer invoke_control for actionable UIA matches, and use send_message for Win32 child controls when needed."
                : "UI Automation controls were exposed for this window. Prefer invoke_control for actionable controls and as_vision_target only when the needed element still is not represented.",
          },
        });
      }
      return json({ success: true, result: normalized });
    }),
  }));

  tools.push(tool({
    name: "as_window_invoke_control",
    description: "Invoke a Windows UI Automation control inside a window by PID or exact window handle using its name, automation id, or control type.",
    parameters: {
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      name: z.string().default(""),
      automation_id: z.string().default(""),
      control_type: z.string().default(""),
      include_offscreen: z.boolean().default(false),
      max_depth: z.number().int().min(1).max(12).default(8),
      match_index: z.number().int().min(1).max(100).default(1),
    },
    implementation: safeTool("as_window_invoke_control", async ({ pid, window_id, name, automation_id, control_type, include_offscreen, max_depth, match_index }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_invoke_control");
      if (unsupported) return unsupported;
      const script = powerShellScript([
        "Add-Type -AssemblyName UIAutomationClient",
        "Add-Type -AssemblyName UIAutomationTypes",
        ...buildWindowsInputGuard({ pid, windowId: window_id }),
        `$nameQuery = ${escapeForPowerShellSingleQuoted(String(name || "").trim().toLowerCase())}`,
        `$automationIdQuery = ${escapeForPowerShellSingleQuoted(String(automation_id || "").trim().toLowerCase())}`,
        `$controlTypeQuery = ${escapeForPowerShellSingleQuoted(String(control_type || "").trim().toLowerCase())}`,
        `$includeOffscreen = ${include_offscreen ? "$true" : "$false"}`,
        `$requestedMaxDepth = ${Math.max(1, Number(max_depth) || 8)}`,
        "$maxDepth = [Math]::Max($requestedMaxDepth, 12)",
        `$matchIndex = ${Math.max(1, Number(match_index) || 1)}`,
        "$root = [System.Windows.Automation.AutomationElement]::FromHandle($resolvedTargetHandle)",
        "if (-not $root) { throw 'Unable to resolve a UI Automation root element for the window.' }",
        "function Convert-Bounds($rect) {",
        "  if (-not $rect) { return $null }",
        "  return @{ x = [int][Math]::Round($rect.Left); y = [int][Math]::Round($rect.Top); width = [int][Math]::Round($rect.Width); height = [int][Math]::Round($rect.Height) }",
        "}",
        "function Match-Control($entry) {",
        "  $ok = $true",
        "  if ($nameQuery) { $ok = $ok -and ([string]$entry.name).ToLower().Contains($nameQuery) }",
        "  if ($automationIdQuery) { $ok = $ok -and ([string]$entry.automationId).ToLower().Contains($automationIdQuery) }",
        "  if ($controlTypeQuery) {",
        "    $controlTypeOk = ([string]$entry.controlType).ToLower().Contains($controlTypeQuery) -or ([string]$entry.localizedControlType).ToLower().Contains($controlTypeQuery) -or ([string]$entry.className).ToLower().Contains($controlTypeQuery)",
        "    $ok = $ok -and $controlTypeOk",
        "  }",
        "  if (-not $includeOffscreen -and $entry.isOffscreen) { $ok = $false }",
        "  return $ok",
        "}",
        "function Get-MatchScore($entry) {",
        "  $score = 0",
        "  $entryName = ([string]$entry.name).ToLower()",
        "  $entryAutomationId = ([string]$entry.automationId).ToLower()",
        "  $entryControlType = ([string]$entry.controlType).ToLower()",
        "  $entryLocalizedType = ([string]$entry.localizedControlType).ToLower()",
        "  $entryClassName = ([string]$entry.className).ToLower()",
        "  if ($nameQuery) {",
        "    if ($entryName -eq $nameQuery) { $score += 0 }",
        "    elseif ($entryName.StartsWith($nameQuery)) { $score += 5 }",
        "    else { $score += 15 }",
        "  }",
        "  if ($automationIdQuery) {",
        "    if ($entryAutomationId -eq $automationIdQuery) { $score += 0 }",
        "    elseif ($entryAutomationId.StartsWith($automationIdQuery)) { $score += 5 }",
        "    else { $score += 15 }",
        "  }",
        "  if ($controlTypeQuery) {",
        "    if ($entryControlType -eq $controlTypeQuery -or $entryLocalizedType -eq $controlTypeQuery -or $entryClassName -eq $controlTypeQuery) { $score += 0 }",
        "    else { $score += 5 }",
        "  }",
        "  if (-not $entry.isEnabled) { $score += 50 }",
        "  if ($entry.isOffscreen) { $score += 25 }",
        "  return $score",
        "}",
        "$queue = New-Object 'System.Collections.Generic.Queue[object]'",
        "$queue.Enqueue([pscustomobject]@{ element = $root; depth = 0 })",
        "$matches = New-Object 'System.Collections.Generic.List[object]'",
        "while ($queue.Count -gt 0) {",
        "  $node = $queue.Dequeue()",
        "  $element = $node.element",
        "  $depth = [int]$node.depth",
        "  if ($depth -gt 0) {",
        "    try {",
        "      $current = $element.Current",
        "      $entry = [pscustomobject]@{",
        "        depth = $depth",
        "        name = [string]$current.Name",
        "        automationId = [string]$current.AutomationId",
        "        className = [string]$current.ClassName",
        "        localizedControlType = [string]$current.LocalizedControlType",
        "        controlType = if ($current.ControlType) { [string]$current.ControlType.ProgrammaticName } else { '' }",
        "        processId = [int]$current.ProcessId",
        "        isEnabled = [bool]$current.IsEnabled",
        "        isOffscreen = [bool]$current.IsOffscreen",
        "        bounds = Convert-Bounds $current.BoundingRectangle",
        "      }",
        "      if (Match-Control $entry) { $matches.Add([pscustomobject]@{ element = $element; entry = $entry; score = (Get-MatchScore $entry) }) | Out-Null }",
        "    } catch {}",
        "  }",
        "  if ($depth -lt $maxDepth) {",
        "    try {",
        "      $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)",
        "      for ($i = 0; $i -lt $children.Count; $i++) {",
        "        $queue.Enqueue([pscustomobject]@{ element = $children.Item($i); depth = ($depth + 1) })",
        "      }",
        "    } catch {}",
        "  }",
        "}",
        "$orderedMatches = @($matches | Sort-Object @{ Expression = { $_.score } }, @{ Expression = { $_.entry.depth } }, @{ Expression = { $_.entry.bounds.y } }, @{ Expression = { $_.entry.bounds.x } })",
        "$matchCount = $orderedMatches.Count",
        "$targetMatch = if ($matchIndex -le $matchCount) { $orderedMatches[$matchIndex - 1] } else { $null }",
        "$targetElement = if ($targetMatch) { $targetMatch.element } else { $null }",
        "$targetEntry = if ($targetMatch) { $targetMatch.entry } else { $null }",
        "if (-not $targetElement) {",
        "  @{ success = $false; pid = $resolvedTargetPid; requestedPid = $targetPid; requestedWindowId = $targetWindowId; windowId = [string]$resolvedTargetHandle; requestedMaxDepth = $requestedMaxDepth; searchDepthUsed = $maxDepth; matched = $matchCount; matchIndex = $matchIndex; error = 'No matching UI Automation control was found.'; hint = 'Call action=\"controls\" to inspect available control names first. Reuse the same max_depth from controls or a larger one. Use invoke_control only for actionable controls.' } | ConvertTo-Json -Compress -Depth 8",
        "  return",
        "}",
        "$method = $null",
        "try { $targetElement.SetFocus(); Start-Sleep -Milliseconds 50 } catch {}",
        "try {",
        "  $invokePattern = $targetElement.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)",
        "  if ($invokePattern) { $invokePattern.Invoke(); $method = 'InvokePattern.Invoke' }",
        "} catch {}",
        "if (-not $method) {",
        "  try {",
        "    $selectionPattern = $targetElement.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)",
        "    if ($selectionPattern) { $selectionPattern.Select(); $method = 'SelectionItemPattern.Select' }",
        "  } catch {}",
        "}",
        "if (-not $method) {",
        "  try {",
        "    $expandPattern = $targetElement.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)",
        "    if ($expandPattern) {",
        "      $state = $expandPattern.Current.ExpandCollapseState",
        "      if ($state -eq [System.Windows.Automation.ExpandCollapseState]::Expanded) {",
        "        $expandPattern.Collapse(); $method = 'ExpandCollapsePattern.Collapse'",
        "      } else {",
        "        $expandPattern.Expand(); $method = 'ExpandCollapsePattern.Expand'",
        "      }",
        "    }",
        "  } catch {}",
        "}",
        "if (-not $method) {",
        "  try {",
        "    $togglePattern = $targetElement.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)",
        "    if ($togglePattern) { $togglePattern.Toggle(); $method = 'TogglePattern.Toggle' }",
        "  } catch {}",
        "}",
        "if (-not $method) {",
        "  try {",
        "    $legacyPattern = $targetElement.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)",
        "    if ($legacyPattern) { $legacyPattern.DoDefaultAction(); $method = 'LegacyIAccessiblePattern.DoDefaultAction' }",
        "  } catch {}",
        "}",
        "if (-not $method) { $method = 'SetFocus' }",
        "Start-Sleep -Milliseconds 150",
        "@{ success = $true; pid = $resolvedTargetPid; requestedPid = $targetPid; requestedWindowId = $targetWindowId; windowId = [string]$resolvedTargetHandle; requestedMaxDepth = $requestedMaxDepth; searchDepthUsed = $maxDepth; depthAutoExpanded = ($targetEntry.depth -gt $requestedMaxDepth); matched = $matchCount; matchIndex = $matchIndex; method = $method; control = $targetEntry } | ConvertTo-Json -Compress -Depth 8",
      ]);
      const result = await runPowerShellScriptFile(script, "window-invoke");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const normalized = parsed && typeof parsed === "object"
        ? {
          ...parsed,
          control: normalizeUiAutomationControlRecord(parsed.control),
        }
        : parsed;
      return json({ success: !result.error && Boolean(normalized?.success), result: normalized, stderr: result.stderr, error: result.error });
    }),
  }));

  tools.push(tool({
    name: "as_window_send_message",
    description: "Send a direct Win32 SendMessage or PostMessage call to an exact child window handle or top-level window handle.",
    parameters: {
      window_id: z.string(),
      message: z.string(),
      w_param: z.string().default("0"),
      l_param: z.string().default("0"),
      use_post_message: z.boolean().default(false),
    },
    implementation: safeTool("as_window_send_message", async ({ window_id, message, w_param, l_param, use_post_message }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_send_message");
      if (unsupported) return unsupported;
      const exactWindowId = String(window_id || "").trim();
      if (!exactWindowId) {
        throw new Error("window_id is required and must be an exact window handle.");
      }
      const messageCode = resolveWindowsMessageCode(message);
      const wParamValue = parseWindowsIntegralParameter(w_param, "w_param");
      const lParamValue = parseWindowsIntegralParameter(l_param, "l_param");
      const script = powerShellScript([
        "$sig = @'",
        "using System;",
        "using System.Text;",
        "using System.Runtime.InteropServices;",
        "public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
        "public static class WinApi {",
        "  [DllImport(\"user32.dll\")] public static extern bool IsWindow(IntPtr hWnd);",
        "  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);",
        "  [DllImport(\"user32.dll\")] public static extern bool IsWindowEnabled(IntPtr hWnd);",
        "  [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);",
        "  [DllImport(\"user32.dll\")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);",
        "  [DllImport(\"user32.dll\")] public static extern IntPtr GetParent(IntPtr hWnd);",
        "  [DllImport(\"user32.dll\")] public static extern int GetDlgCtrlID(IntPtr hWnd);",
        "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);",
        "  [DllImport(\"dwmapi.dll\")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);",
        "  [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);",
        "  [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);",
        "}",
        "'@;",
        "Add-Type $sig",
        `$targetHandle = [IntPtr]::new([long]${Number.parseInt(exactWindowId, 10)})`,
        "if ($targetHandle -eq [IntPtr]::Zero -or -not [WinApi]::IsWindow($targetHandle)) { throw 'No valid window exists for the provided exact window_id.' }",
        "$titleBuilder = New-Object System.Text.StringBuilder 1024",
        "[WinApi]::GetWindowText($targetHandle, $titleBuilder, $titleBuilder.Capacity) | Out-Null",
        "$classBuilder = New-Object System.Text.StringBuilder 512",
        "[WinApi]::GetClassName($targetHandle, $classBuilder, $classBuilder.Capacity) | Out-Null",
        "$rect = New-Object RECT",
        "$dwmResult = [WinApi]::DwmGetWindowAttribute($targetHandle, 9, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([type][RECT]))",
        "if ($dwmResult -ne 0) { [WinApi]::GetWindowRect($targetHandle, [ref]$rect) | Out-Null }",
        `$messageCode = [uint32]${messageCode}`,
        `$wParamValue = [IntPtr]::new([long]${wParamValue})`,
        `$lParamValue = [IntPtr]::new([long]${lParamValue})`,
        `$usePostMessage = ${use_post_message ? "$true" : "$false"}`,
        "$postOk = $false",
        "$sendResult = [IntPtr]::Zero",
        "if ($usePostMessage) {",
        "  $postOk = [WinApi]::PostMessage($targetHandle, $messageCode, $wParamValue, $lParamValue)",
        "} else {",
        "  $sendResult = [WinApi]::SendMessage($targetHandle, $messageCode, $wParamValue, $lParamValue)",
        "}",
        "@{ success = if ($usePostMessage) { [bool]$postOk } else { $true }; windowId = [string]$targetHandle.ToInt64(); method = if ($usePostMessage) { 'PostMessage' } else { 'SendMessage' }; messageCode = [int64]$messageCode; messageHex = ('0x{0:X}' -f [int64]$messageCode); wParam = [int64]$wParamValue.ToInt64(); lParam = [int64]$lParamValue.ToInt64(); result = if ($usePostMessage) { if ($postOk) { 1 } else { 0 } } else { [int64]$sendResult.ToInt64() }; control = @{ source = 'win32'; name = $titleBuilder.ToString(); windowText = $titleBuilder.ToString(); automationId = ''; className = $classBuilder.ToString(); localizedControlType = ''; controlType = ''; frameworkId = 'win32'; isEnabled = [bool][WinApi]::IsWindowEnabled($targetHandle); isOffscreen = -not [bool][WinApi]::IsWindowVisible($targetHandle); hasKeyboardFocus = $false; nativeWindowHandle = [string]$targetHandle.ToInt64(); parentWindowHandle = [string]([WinApi]::GetParent($targetHandle).ToInt64()); controlId = [int][WinApi]::GetDlgCtrlID($targetHandle); bounds = @{ x = [int]$rect.Left; y = [int]$rect.Top; width = [int]($rect.Right - $rect.Left); height = [int]($rect.Bottom - $rect.Top) }; messageDispatchable = $true; messageHints = @() } } | ConvertTo-Json -Compress -Depth 8",
      ]);
      const result = await runPowerShellScriptFile(script, "window-send-message");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const normalized = parsed && typeof parsed === "object"
        ? {
          ...parsed,
          control: normalizeDesktopControlRecord(parsed.control),
        }
        : parsed;
      return json({ success: !result.error && Boolean(normalized?.success), result: normalized, stderr: result.stderr, error: result.error });
    }),
  }));

  tools.push(tool({
    name: "as_window_maximize",
    description: "Maximize or restore a window by PID.",
    parameters: {
      pid: z.number().int().min(0),
      action: z.enum(["maximize", "restore"]).default("maximize"),
    },
    implementation: safeTool("as_window_maximize", async ({ pid, action }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_window_maximize");
      if (unsupported) return unsupported;
      const showCode = action === "restore" ? 9 : 3;
      const script = powerShellScript([
        "$sig = @'",
        "using System;",
        "using System.Runtime.InteropServices;",
        "public static class WinApi {",
        "  [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
        "}",
        "'@;",
        "Add-Type $sig",
        ...buildWindowsResolvedWindowContext(Number(pid)),
        `[WinApi]::ShowWindowAsync($resolvedHandle, ${showCode}) | Out-Null`,
        `@{ success = $true; pid = $resolvedPid; requestedPid = $pidValue; windowId = [string]$resolvedHandle; action = ${escapeForPowerShellSingleQuoted(action as string)}; title = $resolvedTitle; processName = $resolvedProcessName; path = $resolvedPath } | ConvertTo-Json -Compress`,
      ]);
      const result = await runPowerShellScriptFile(script, "input-keyboard");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_keyboard",
    description: "Send literal text to the active window. Use after focusing the intended window. On Windows this uses native Unicode text dispatch so characters like +, %, ^, braces, brackets, and parentheses are typed as literal text instead of being misread as modifiers.",
    parameters: {
      text: z.string().default(""),
      send_enter: z.boolean().default(false),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_keyboard", async ({ text, send_enter, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_keyboard");
      if (unsupported) return unsupported;
      const delay = clampDelayMs(delay_ms);
      const literalText = String(text ?? "");
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input, includeMouseApi: true }),
        ...buildWindowsUnicodeTextHelper(),
        "try {",
        literalText.length > 0 ? `Send-UnicodeText ${escapeForPowerShellSingleQuoted(literalText)}` : null,
        (send_enter as boolean) ? "  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')" : null,
        powerShellDelay(delay),
        `  $result = @{ success = $true; delayMs = ${delay}; sent = ${escapeForPowerShellSingleQuoted(literalText)}; sentText = ${escapeForPowerShellSingleQuoted(literalText)}; sendEnter = ${send_enter ? "$true" : "$false"}; mode = 'unicode_sendinput'; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied }`,
        "} finally {",
        ...buildWindowsInputGuardFinally(),
        "}",
        "$result | ConvertTo-Json -Compress",
      ].filter(Boolean));
      const result = await runPowerShellScriptFile(script, "input-keyboard-combo");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_keyboard_combo",
    description: "Send a key press or key combination to the active window. Accepts friendly forms like ctrl+a, enter, delete, escape, alt+tab, shift+enter, and native SendKeys forms like ^a or %{TAB}.",
    parameters: {
      combo: z.string(),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_keyboard_combo", async ({ combo, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_keyboard_combo");
      if (unsupported) return unsupported;
      const delay = clampDelayMs(delay_ms);
      const normalizedCombo = normalizeSendKeysCombo(combo);
      if (!normalizedCombo) {
        throw new Error("combo is required and must resolve to a non-empty key press.");
      }
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input }),
        "try {",
        `[System.Windows.Forms.SendKeys]::SendWait(${escapeForPowerShellSingleQuoted(normalizedCombo)})`,
        powerShellDelay(delay),
        `  $result = @{ success = $true; combo = ${escapeForPowerShellSingleQuoted(combo as string)}; normalizedCombo = ${escapeForPowerShellSingleQuoted(normalizedCombo)}; delayMs = ${delay}; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied }`,
        "} finally {",
        ...buildWindowsInputGuardFinally(),
        "}",
        "$result | ConvertTo-Json -Compress",
      ].filter(Boolean));
      const result = await runPowerShellScriptFile(script, "input-keyboard-combo");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_autohotkey",
    description: "Run a bespoke AutoHotkey v2 script on Windows as an advanced desktop-automation fallback. Use this only after the higher-level window, control, input, and screenshot tools are still too brittle or too limited for the task. Runtime errors are returned headlessly in the tool result instead of waiting on an AutoHotkey dialog. When pid or window_id is supplied, the wrapper injects AgenticWindowId/X/Y/Width/Height plus helpers such as AgenticWindowMouseMove, MouseDown, and MouseUp.",
    parameters: {
      script: z.string(),
      args_json: z.string().default("[]"),
      timeout_ms: z.number().int().min(1000).max(600000).default(60000),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
    },
    implementation: safeTool("as_input_autohotkey", async ({ script, args_json, timeout_ms, pid, window_id }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_autohotkey");
      if (unsupported) return unsupported;
      const parsedArgs = JSON.parse(String(args_json || "[]"));
      if (!Array.isArray(parsedArgs)) {
        throw new Error("args_json must be a JSON array.");
      }
      const executable = await resolveExecutablePath(ctl, env, "autoHotkeyPath", "AutoHotkey64.exe");
      const normalizedScript = String(script || "").replace(/\r\n/g, "\n").trim();
      if (!normalizedScript) {
        throw new Error("script is required.");
      }
      let targetWindow: Record<string, unknown> | null = null;
      if ((typeof pid === "number" && Number.isFinite(pid) && pid > 0) || String(window_id || "").trim()) {
        const targetScript = powerShellScript([
          ...buildWindowsInputGuard({ pid, windowId: window_id }),
          "@{ success = $true; pid = $resolvedTargetPid; windowId = [string]$resolvedTargetHandle; x = $resolvedRect.Left; y = $resolvedRect.Top; width = ($resolvedRect.Right - $resolvedRect.Left); height = ($resolvedRect.Bottom - $resolvedRect.Top); title = $resolvedTitle; processName = $resolvedProcessName; path = $resolvedPath } | ConvertTo-Json -Compress",
        ]);
        const targetResult = await runPowerShellScriptFile(targetScript, "autohotkey-target");
        if (targetResult.error) {
          throw new Error(compactCommandError(targetResult.stderr, targetResult.error, "Unable to resolve the target window for AutoHotkey."));
        }
        targetWindow = targetResult.stdout ? JSON.parse(targetResult.stdout) : null;
      }
      const tempDirectory = await resolveToolTempDirectory();
      const resultPath = path.join(tempDirectory, `autohotkey-result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
      const escapeForAutoHotkeyString = (value: unknown) => String(value ?? "").replace(/`/g, "``").replace(/"/g, "\"\"");
      const agenticWindowId = String(targetWindow?.windowId || "").trim();
      const agenticWindowX = Math.trunc(Number(targetWindow?.x) || 0);
      const agenticWindowY = Math.trunc(Number(targetWindow?.y) || 0);
      const agenticWindowWidth = Math.trunc(Number(targetWindow?.width) || 0);
      const agenticWindowHeight = Math.trunc(Number(targetWindow?.height) || 0);
      const finalScript = [
        /^#Requires\s+AutoHotkey\s+v2/i.test(normalizedScript) ? "" : "#Requires AutoHotkey v2.0",
        "#SingleInstance Force",
        "CoordMode(\"Mouse\", \"Screen\")",
        `__AgenticResultPath := "${escapeForAutoHotkeyString(resultPath)}"`,
        `AgenticWindowId := "${escapeForAutoHotkeyString(agenticWindowId)}"`,
        `AgenticWindowX := ${agenticWindowX}`,
        `AgenticWindowY := ${agenticWindowY}`,
        `AgenticWindowWidth := ${agenticWindowWidth}`,
        `AgenticWindowHeight := ${agenticWindowHeight}`,
        "MouseDown(button := \"Left\") {",
        "  Click(\"Down \" . button)",
        "}",
        "MouseUp(button := \"Left\") {",
        "  Click(\"Up \" . button)",
        "}",
        "AgenticWindowToScreenX(x) {",
        "  global AgenticWindowX",
        "  return AgenticWindowX + x",
        "}",
        "AgenticWindowToScreenY(y) {",
        "  global AgenticWindowY",
        "  return AgenticWindowY + y",
        "}",
        "AgenticWindowMouseMove(x, y, speed := 2) {",
        "  MouseMove(AgenticWindowToScreenX(x), AgenticWindowToScreenY(y), speed)",
        "}",
        "AgenticWindowClick(x, y, button := \"Left\", clickCount := 1, speed := 2) {",
        "  AgenticWindowMouseMove(x, y, speed)",
        "  Click(button, clickCount)",
        "}",
        "AgenticWindowDrag(fromX, fromY, toX, toY, button := \"Left\", moveSpeed := 8, holdBeforeMs := 80, holdAfterMs := 80) {",
        "  AgenticWindowMouseMove(fromX, fromY, moveSpeed)",
        "  Sleep(holdBeforeMs)",
        "  MouseDown(button)",
        "  Sleep(30)",
        "  AgenticWindowMouseMove(toX, toY, moveSpeed)",
        "  Sleep(holdAfterMs)",
        "  MouseUp(button)",
        "}",
        "AgenticActivateWindow() {",
        "  global AgenticWindowId",
        "  if (AgenticWindowId != \"\") {",
        "    WinActivate(\"ahk_id \" . AgenticWindowId)",
        "    WinWaitActive(\"ahk_id \" . AgenticWindowId,, 2)",
        "    Sleep(150)",
        "  }",
        "}",
        "try {",
        "  AgenticActivateWindow()",
        normalizedScript,
        "  try FileDelete(__AgenticResultPath)",
        "  FileAppend(\"success\", __AgenticResultPath, \"UTF-8\")",
        "  ExitApp(0)",
        "} catch as err {",
        "  __agenticMessage := \"Error: \" . err.Message",
        "  try if (err.What != \"\") __agenticMessage .= \"`nWhat: \" . err.What",
        "  try if (err.Line) __agenticMessage .= \"`nLine: \" . err.Line",
        "  try if (err.Extra != \"\") __agenticMessage .= \"`nExtra: \" . err.Extra",
        "  try if (err.Stack != \"\") __agenticMessage .= \"`nStack:`n\" . err.Stack",
        "  try FileDelete(__AgenticResultPath)",
        "  FileAppend(__agenticMessage, __AgenticResultPath, \"UTF-8\")",
        "  ExitApp(1)",
        "}",
        "",
      ].filter(Boolean).join("\n");
      let sidecarText = "";
      try {
        const result = await runTemporaryExecutableScriptFile(
          finalScript,
          "autohotkey",
          "ahk",
          executable,
          parsedArgs.map((entry) => String(entry ?? "")),
          Math.max(1000, Math.trunc(Number(timeout_ms) || 60000)),
          { prependArgs: ["/ErrorStdOut=UTF-8"] },
        );
        try {
          sidecarText = await fsp.readFile(resultPath, "utf8");
        } catch {}
        const normalizedSidecarText = String(sidecarText || "").trim();
        const sidecarSuccess = normalizedSidecarText.toLowerCase() === "success";
        const sidecarErrorText = sidecarSuccess ? "" : normalizedSidecarText;
        const success = !result.error && result.exitCode === 0 && (!normalizedSidecarText || sidecarSuccess);
        return json({
          success,
          runtime: "autohotkey_v2",
          executable,
          targetWindow: targetWindow || undefined,
          stdout: result.stdout,
          stderr: [String(result.stderr || "").trim(), sidecarErrorText].filter(Boolean).join("\n") || "",
          error: success ? null : compactCommandError(sidecarErrorText || result.stderr, result.error, "AutoHotkey script failed."),
          exitCode: typeof result.exitCode === "number" ? result.exitCode : (success ? 0 : 1),
        });
      } finally {
        await fsp.rm(resultPath, { force: true }).catch(() => {});
      }
    }),
  }));

tools.push(tool({
    name: "as_input_key_event",
    description: "Send lower-level Windows key events with optional modifiers, repeat counts, and explicit down/up control. Use when SendKeys-style combos are not reliable enough.",
    parameters: {
      key: z.string(),
      key_action: z.enum(["press", "down", "up"]).default("press"),
      modifiers_json: z.string().default("[]"),
      repeat_count: z.number().int().min(1).max(100).default(1),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_key_event", async ({ key, key_action, modifiers_json, repeat_count, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_key_event");
      if (unsupported) return unsupported;
      const delay = clampDelayMs(delay_ms);
      const normalizedKey = normalizeVirtualKeyName(key);
      const modifierList = JSON.parse(String(modifiers_json || "[]"));
      if (!Array.isArray(modifierList) || modifierList.some((entry) => typeof entry !== "string")) {
        throw new Error("modifiers_json must be a JSON string array.");
      }
      const normalizedModifiers = modifierList.map((entry) => normalizeVirtualKeyName(entry)).filter(Boolean);
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input, includeMouseApi: true }),
        ...buildWindowsUnicodeTextHelper(),
        ...buildWindowsVirtualKeyDispatchFunctions(),
        "try {",
        `  $keyName = ${escapeForPowerShellSingleQuoted(normalizedKey)}`,
        `  $keyAction = ${escapeForPowerShellSingleQuoted(String(key_action || "press"))}`,
        `  $repeatCount = ${Math.max(1, Math.trunc(Number(repeat_count) || 1))}`,
        `  $modifierNames = @(${normalizedModifiers.map((entry) => escapeForPowerShellSingleQuoted(entry)).join(", ")})`,
        "  $keyCode = Resolve-KeyCode $keyName",
        "  $modifierCodes = @($modifierNames | Where-Object { $_ } | ForEach-Object { Resolve-KeyCode $_ })",
        "  if ($keyAction -eq 'press') {",
        "    for ($m = 0; $m -lt $modifierCodes.Count; $m++) { Send-KeyDown $modifierNames[$m] $modifierCodes[$m]; Start-Sleep -Milliseconds 15 }",
        "    for ($i = 0; $i -lt $repeatCount; $i++) {",
        "      Send-KeyDown $keyName $keyCode",
        "      Start-Sleep -Milliseconds 15",
        "      Send-KeyUp $keyName $keyCode",
        "      if ($i -lt ($repeatCount - 1)) { Start-Sleep -Milliseconds 20 }",
        "    }",
        "    for ($i = $modifierCodes.Count - 1; $i -ge 0; $i--) { Send-KeyUp $modifierNames[$i] $modifierCodes[$i]; Start-Sleep -Milliseconds 15 }",
        "  } elseif ($keyAction -eq 'down') {",
        "    for ($m = 0; $m -lt $modifierCodes.Count; $m++) { Send-KeyDown $modifierNames[$m] $modifierCodes[$m]; Start-Sleep -Milliseconds 15 }",
        "    Send-KeyDown $keyName $keyCode",
        "  } else {",
        "    Send-KeyUp $keyName $keyCode",
        "    for ($i = $modifierCodes.Count - 1; $i -ge 0; $i--) { Send-KeyUp $modifierNames[$i] $modifierCodes[$i]; Start-Sleep -Milliseconds 15 }",
        "  }",
        powerShellDelay(delay),
        `  $result = @{ success = $true; key = ${escapeForPowerShellSingleQuoted(normalizedKey)}; keyAction = ${escapeForPowerShellSingleQuoted(String(key_action || "press"))}; modifiers = @(${normalizedModifiers.map((entry) => escapeForPowerShellSingleQuoted(entry)).join(", ")}); repeatCount = ${Math.max(1, Math.trunc(Number(repeat_count) || 1))}; delayMs = ${delay}; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied }`,
        "} finally {",
        ...buildWindowsInputGuardFinally(),
        "}",
        "$result | ConvertTo-Json -Compress",
      ].filter(Boolean));
      const result = await runPowerShellScriptFile(script, "input-key-event");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_keyboard_sequence",
    description: "Send a sequence of keyboard actions with per-step delays. Text steps are escaped as literal text; combo steps accept friendly hotkeys like ctrl+a, enter, delete, and escape. Steps may use text/combo fields directly or action/type plus value/text/press for compact model-friendly schemas.",
    parameters: {
      steps_json: z.string(),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_keyboard_sequence", async ({ steps_json, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_keyboard_sequence");
      if (unsupported) return unsupported;
      const defaultDelay = clampDelayMs(delay_ms);
      const steps = JSON.parse(steps_json as string);
      if (!Array.isArray(steps)) {
        throw new Error("steps_json must be a JSON array.");
      }
      const commands = [
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input, includeMouseApi: true }),
        ...buildWindowsUnicodeTextHelper(),
        ...buildWindowsVirtualKeyDispatchFunctions(),
        "$ErrorActionPreference = 'Stop'",
        "try {",
      ];
      for (const step of steps) {
        if (!step || typeof step !== "object") {
          throw new Error("Each keyboard step must be an object.");
        }
        const record = step as Record<string, unknown>;
        const declaredAction = String(record.action || record.type || "").toLowerCase();
        const hasActionValuePair = (typeof record.value === "string" || typeof record.key === "string") && Boolean(declaredAction);
        const delayMs = typeof record.delay_ms === "number"
          ? record.delay_ms
          : typeof record.delay === "number"
            ? record.delay
            : null;
        const delayOnly = delayMs !== null
          && typeof record.text !== "string"
          && typeof record.combo !== "string"
          && typeof record.press !== "string"
          && typeof record.key !== "string"
          && !hasActionValuePair;
        const actionType = declaredAction || (typeof record.combo === "string" || typeof record.press === "string" || typeof record.key === "string" ? "combo" : "text");
        const comboLikeAction = actionType === "combo" || actionType === "hotkey" || actionType === "key" || actionType === "press";
        const repeatCount = typeof record.repeat_count === "number"
          ? Math.max(1, Math.trunc(Number(record.repeat_count) || 1))
          : typeof record.repeat === "number"
            ? Math.max(1, Math.trunc(Number(record.repeat) || 1))
            : 1;
        const literalTextValue = typeof record.text === "string"
          ? record.text
          : hasActionValuePair && !comboLikeAction
            ? String(typeof record.key === "string" ? record.key : record.value)
            : null;
        const friendlyKeySource = typeof record.combo === "string"
          ? record.combo
          : typeof record.press === "string"
            ? record.press
            : typeof record.key === "string"
              ? record.key
              : hasActionValuePair && comboLikeAction
                ? typeof record.key === "string"
                  ? record.key
                  : record.value
                : null;
        const friendlyKeySpec = friendlyKeySource === null ? null : tryParseFriendlyKeyChord(friendlyKeySource);
        const normalizedValue = typeof record.text === "string"
          ? null
          : typeof record.combo === "string"
            ? normalizeSendKeysCombo(record.combo)
            : typeof record.press === "string"
              ? normalizeSendKeysCombo(record.press)
              : typeof record.key === "string"
                ? normalizeSendKeysCombo(record.key)
              : hasActionValuePair
                ? comboLikeAction
                  ? normalizeSendKeysCombo(typeof record.key === "string" ? record.key : record.value)
                  : escapeSendKeysText(typeof record.key === "string" ? record.key : record.value)
                : null;
        if (delayMs !== null) {
          commands.push(`Start-Sleep -Milliseconds ${Math.max(0, Math.trunc(Number(delayMs)))}`);
        }
        if (delayOnly) {
          continue;
        }
        if (literalTextValue !== null) {
          commands.push(`Send-UnicodeText ${escapeForPowerShellSingleQuoted(literalTextValue)}`);
        } else if (friendlyKeySpec) {
          const modifierList = friendlyKeySpec.modifierNames.length > 0
            ? `@(${friendlyKeySpec.modifierNames.map((entry) => escapeForPowerShellSingleQuoted(entry)).join(", ")})`
            : "@()";
          commands.push(`Send-FriendlyKeyPress ${escapeForPowerShellSingleQuoted(friendlyKeySpec.keyName)} ${modifierList} ${repeatCount}`);
        } else if (typeof record.text === "string") {
          commands.push(`[System.Windows.Forms.SendKeys]::SendWait(${escapeForPowerShellSingleQuoted(normalizedValue)})`);
        } else if (typeof record.combo === "string" || typeof record.press === "string" || typeof record.key === "string") {
          commands.push(`[System.Windows.Forms.SendKeys]::SendWait(${escapeForPowerShellSingleQuoted(normalizedValue)})`);
        } else if (normalizedValue !== null) {
          commands.push(`[System.Windows.Forms.SendKeys]::SendWait(${escapeForPowerShellSingleQuoted(normalizedValue)})`);
        } else {
          throw new Error("Each keyboard step must include text, combo, key, press, or an action/type with value.");
        }
        if (defaultDelay > 0) commands.push(`Start-Sleep -Milliseconds ${defaultDelay}`);
      }
      commands.push(`  $result = @{ success = $true; steps = ${steps.length}; defaultDelayMs = ${defaultDelay}; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied }`);
      commands.push("} finally {");
      commands.push(...buildWindowsInputGuardFinally());
      commands.push("}");
      commands.push("$result | ConvertTo-Json -Compress");
      const result = await runPowerShellScriptFile(powerShellScript(commands), "input-sequence");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_mouse",
    description: "Move the mouse or perform richer click/down/up actions at screen coordinates, with optional smooth motion.",
    parameters: {
      action: z.enum(["move", "left_click", "right_click", "middle_click", "double_click", "triple_click", "left_down", "left_up", "right_down", "right_up", "middle_down", "middle_up"]).default("move"),
      x: z.number().int(),
      y: z.number().int(),
      move_steps: z.number().int().min(1).max(500).default(1),
      move_duration_ms: z.number().int().min(0).max(60000).default(0),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_mouse", async ({ action, x, y, move_steps, move_duration_ms, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_mouse");
      if (unsupported) return unsupported;
      const delay = clampDelayMs(delay_ms);
      const steps = clampMotionSteps(move_steps, 1);
      const moveDuration = clampMotionDurationMs(move_duration_ms, 0);
      const clickScriptMap: Record<string, string[]> = {
        move: [],
        left_click: [
          "[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
          "Start-Sleep -Milliseconds 15",
          "[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
        ],
        right_click: [
          "[WinApi]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero)",
          "Start-Sleep -Milliseconds 15",
          "[WinApi]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)",
        ],
        middle_click: [
          "[WinApi]::mouse_event(0x0020, 0, 0, 0, [UIntPtr]::Zero)",
          "Start-Sleep -Milliseconds 15",
          "[WinApi]::mouse_event(0x0040, 0, 0, 0, [UIntPtr]::Zero)",
        ],
        double_click: [
          "[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
          "[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
          "Start-Sleep -Milliseconds 60",
          "[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
          "[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
        ],
        triple_click: [
          "[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
          "[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
          "Start-Sleep -Milliseconds 60",
          "[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
          "[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
          "Start-Sleep -Milliseconds 60",
          "[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)",
          "[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)",
        ],
        left_down: ["[WinApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)"],
        left_up: ["[WinApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)"],
        right_down: ["[WinApi]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero)"],
        right_up: ["[WinApi]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)"],
        middle_down: ["[WinApi]::mouse_event(0x0020, 0, 0, 0, [UIntPtr]::Zero)"],
        middle_up: ["[WinApi]::mouse_event(0x0040, 0, 0, 0, [UIntPtr]::Zero)"],
      };
      const actionScript = clickScriptMap[String(action || "move")] || [];
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input, includeMouseApi: true }),
        "try {",
        "  function Move-CursorSmooth([int]$fromX, [int]$fromY, [int]$toX, [int]$toY, [int]$steps, [int]$durationMs) {",
        "    if ($steps -le 1 -or $durationMs -le 0) { [WinApi]::SetCursorPos($toX, $toY) | Out-Null; return }",
        "    $sleepMs = [Math]::Floor($durationMs / $steps)",
        "    if ($sleepMs -lt 0) { $sleepMs = 0 }",
        "    for ($i = 1; $i -le $steps; $i++) {",
        "      $ratio = $i / [double]$steps",
        "      $nextX = [int][Math]::Round($fromX + (($toX - $fromX) * $ratio))",
        "      $nextY = [int][Math]::Round($fromY + (($toY - $fromY) * $ratio))",
        "      [WinApi]::SetCursorPos($nextX, $nextY) | Out-Null",
        "      if ($i -lt $steps -and $sleepMs -gt 0) { Start-Sleep -Milliseconds $sleepMs }",
        "    }",
        "  }",
        "  $origin = [System.Windows.Forms.Cursor]::Position",
        `  Move-CursorSmooth $origin.X $origin.Y ${Number(x)} ${Number(y)} ${steps} ${moveDuration}`,
        ...actionScript,
        powerShellDelay(delay),
        "  $cursor = [System.Windows.Forms.Cursor]::Position",
        "  $resolvedRect = Get-ResolvedRect $resolvedTargetHandle",
        "  $targetBounds = @{ x = [int]$resolvedRect.Left; y = [int]$resolvedRect.Top; width = [int]($resolvedRect.Right - $resolvedRect.Left); height = [int]($resolvedRect.Bottom - $resolvedRect.Top) }",
        "  $windowRelativeCursor = @{ x = [int]($cursor.X - $resolvedRect.Left); y = [int]($cursor.Y - $resolvedRect.Top); inside = (($cursor.X -ge $resolvedRect.Left) -and ($cursor.Y -ge $resolvedRect.Top) -and ($cursor.X -lt $resolvedRect.Right) -and ($cursor.Y -lt $resolvedRect.Bottom)) }",
        `  $result = @{ success = $true; action = ${escapeForPowerShellSingleQuoted(action as string)}; x = ${Number(x)}; y = ${Number(y)}; moveSteps = ${steps}; moveDurationMs = ${moveDuration}; delayMs = ${delay}; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied; targetWindowBounds = $targetBounds; cursor = @{ screen = @{ x = [int]$cursor.X; y = [int]$cursor.Y }; origin = @{ x = [int]$origin.X; y = [int]$origin.Y } }; windowRelativeCursor = $windowRelativeCursor }`,
        "} finally {",
        ...buildWindowsInputGuardFinally(),
        "}",
        "$result | ConvertTo-Json -Compress",
      ].filter(Boolean));
      const result = await runPowerShellScriptFile(script, "input-mouse");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_mouse_scroll",
    description: "Scroll the mouse wheel by a number of notches at the current cursor position. Supports vertical and horizontal wheel events.",
    parameters: {
      amount: z.number().int().min(-1000).max(1000),
      axis: z.enum(["vertical", "horizontal"]).default("vertical"),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_mouse_scroll", async ({ amount, axis, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_mouse_scroll");
      if (unsupported) return unsupported;
      const delay = clampDelayMs(delay_ms);
      const wheelDelta = Math.trunc(Number(amount) * 120);
      const wheelFlag = String(axis || "vertical") === "horizontal" ? "0x01000" : "0x0800";
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input, includeMouseApi: true }),
        "try {",
        `[WinApi]::mouse_event(${wheelFlag}, 0, 0, [uint32]([int]${wheelDelta}), [UIntPtr]::Zero)`,
        powerShellDelay(delay),
        `  $result = @{ success = $true; amount = ${Number(amount)}; axis = ${escapeForPowerShellSingleQuoted(String(axis || "vertical"))}; wheelDelta = ${wheelDelta}; delayMs = ${delay}; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied }`,
        "} finally {",
        ...buildWindowsInputGuardFinally(),
        "}",
        "$result | ConvertTo-Json -Compress",
      ].filter(Boolean));
      const result = await runPowerShellScriptFile(script, "input-scroll");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_input_mouse_drag",
    description: "Drag the mouse from one screen coordinate to another, with configurable button, smooth motion, and hold timing.",
    parameters: {
      from_x: z.number().int(),
      from_y: z.number().int(),
      to_x: z.number().int(),
      to_y: z.number().int(),
      button: z.enum(["left", "right", "middle"]).default("left"),
      move_steps: z.number().int().min(1).max(500).default(24),
      move_duration_ms: z.number().int().min(0).max(60000).default(250),
      hold_before_drag_ms: z.number().int().min(0).max(10000).default(40),
      hold_after_drag_ms: z.number().int().min(0).max(10000).default(40),
      pid: z.number().int().min(0).default(0),
      window_id: z.string().default(""),
      lock_user_input: z.boolean().default(false),
      delay_ms: z.number().int().min(0).max(10000).default(100),
    },
    implementation: safeTool("as_input_mouse_drag", async ({ from_x, from_y, to_x, to_y, button, move_steps, move_duration_ms, hold_before_drag_ms, hold_after_drag_ms, pid, window_id, lock_user_input, delay_ms }) => {
      requireCommandExecution();
      const unsupported = windowsOnly("as_input_mouse_drag");
      if (unsupported) return unsupported;
      const delay = clampDelayMs(delay_ms);
      const steps = clampMotionSteps(move_steps, 24);
      const moveDuration = clampMotionDurationMs(move_duration_ms, 250);
      const holdBefore = clampDelayMs(hold_before_drag_ms, 40);
      const holdAfter = clampDelayMs(hold_after_drag_ms, 40);
      const normalizedButton = String(button || "left");
      const downFlag = normalizedButton === "right" ? "0x0008" : normalizedButton === "middle" ? "0x0020" : "0x0002";
      const upFlag = normalizedButton === "right" ? "0x0010" : normalizedButton === "middle" ? "0x0040" : "0x0004";
      const script = powerShellScript([
        ...buildWindowsInputGuard({ pid, windowId: window_id, lockUserInput: lock_user_input, includeMouseApi: true }),
        "try {",
        "  function Move-CursorSmooth([int]$fromX, [int]$fromY, [int]$toX, [int]$toY, [int]$steps, [int]$durationMs) {",
        "    if ($steps -le 1 -or $durationMs -le 0) { [WinApi]::SetCursorPos($toX, $toY) | Out-Null; return }",
        "    $sleepMs = [Math]::Floor($durationMs / $steps)",
        "    if ($sleepMs -lt 0) { $sleepMs = 0 }",
        "    for ($i = 1; $i -le $steps; $i++) {",
        "      $ratio = $i / [double]$steps",
        "      $nextX = [int][Math]::Round($fromX + (($toX - $fromX) * $ratio))",
        "      $nextY = [int][Math]::Round($fromY + (($toY - $fromY) * $ratio))",
        "      [WinApi]::SetCursorPos($nextX, $nextY) | Out-Null",
        "      if ($i -lt $steps -and $sleepMs -gt 0) { Start-Sleep -Milliseconds $sleepMs }",
        "    }",
        "  }",
        `[WinApi]::SetCursorPos(${Number(from_x)}, ${Number(from_y)}) | Out-Null`,
        `Start-Sleep -Milliseconds ${holdBefore}`,
        `[WinApi]::mouse_event(${downFlag}, 0, 0, 0, [UIntPtr]::Zero)`,
        `Move-CursorSmooth ${Number(from_x)} ${Number(from_y)} ${Number(to_x)} ${Number(to_y)} ${steps} ${moveDuration}`,
        `Start-Sleep -Milliseconds ${holdAfter}`,
        `[WinApi]::mouse_event(${upFlag}, 0, 0, 0, [UIntPtr]::Zero)`,
        powerShellDelay(delay),
        "  $cursor = [System.Windows.Forms.Cursor]::Position",
        "  $resolvedRect = Get-ResolvedRect $resolvedTargetHandle",
        "  $targetBounds = @{ x = [int]$resolvedRect.Left; y = [int]$resolvedRect.Top; width = [int]($resolvedRect.Right - $resolvedRect.Left); height = [int]($resolvedRect.Bottom - $resolvedRect.Top) }",
        "  $windowRelativeCursor = @{ x = [int]($cursor.X - $resolvedRect.Left); y = [int]($cursor.Y - $resolvedRect.Top); inside = (($cursor.X -ge $resolvedRect.Left) -and ($cursor.Y -ge $resolvedRect.Top) -and ($cursor.X -lt $resolvedRect.Right) -and ($cursor.Y -lt $resolvedRect.Bottom)) }",
        `  $result = @{ success = $true; button = ${escapeForPowerShellSingleQuoted(normalizedButton)}; from = @(${Number(from_x)}, ${Number(from_y)}); to = @(${Number(to_x)}, ${Number(to_y)}); moveSteps = ${steps}; moveDurationMs = ${moveDuration}; holdBeforeDragMs = ${holdBefore}; holdAfterDragMs = ${holdAfter}; delayMs = ${delay}; pid = if ($resolvedTargetPid) { $resolvedTargetPid } else { $null }; windowId = [string]$resolvedTargetHandle; lockUserInputRequested = $lockUserInputRequested; lockUserInputApplied = $lockUserInputApplied; targetWindowBounds = $targetBounds; cursor = @{ screen = @{ x = [int]$cursor.X; y = [int]$cursor.Y } }; windowRelativeCursor = $windowRelativeCursor }`,
        "} finally {",
        ...buildWindowsInputGuardFinally(),
        "}",
        "$result | ConvertTo-Json -Compress",
      ].filter(Boolean));
      const result = await runPowerShellScriptFile(script, "input-drag");
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      return json({ success: !result.error, result: parsed, stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_task_schedule_list",
    description: "List scheduled tasks created by the platform scheduler: Windows Task Scheduler on Windows, user crontab on Linux/macOS.",
    parameters: {
      query: z.string().default(""),
      limit: z.number().int().min(1).max(5000).default(200),
    },
    implementation: safeTool("as_task_schedule_list", async ({ query, limit }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const result = await executeManagedCommand(ctl, "crontab -l", { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const lines = result.stdout ? result.stdout.split(/\r?\n/) : [];
        const tasks = lines
          .filter((line) => line.includes("# agentic-studio:"))
          .map((line) => {
            const marker = line.match(/# agentic-studio:([^\s#]+)/)?.[1] || "";
            const name = decodeURIComponent(marker);
            const command = line.replace(/\s*# agentic-studio:[^\s#]+\s*$/, "").trim();
            return { TaskName: name, TaskPath: "crontab", State: "Scheduled", Author: process.env.USER || process.env.LOGNAME || null, Description: command };
          })
          .filter((item) => !String(query || "").trim() || item.TaskName.toLowerCase().includes(String(query).toLowerCase()) || item.Description.toLowerCase().includes(String(query).toLowerCase()))
          .slice(0, limit as number);
        return json({ success: !result.error || result.exitCode === 1, tasks, stderr: result.exitCode === 1 ? "" : result.stderr, error: result.exitCode === 1 ? null : result.error });
      }
      const script = [
        `$query = ${escapeForPowerShellSingleQuoted(String(query || ""))}`,
        "$items = Get-ScheduledTask | Select-Object TaskName,TaskPath,State,Author,Description",
        "if ($query) { $items = $items | Where-Object { $_.TaskName -like \"*$query*\" -or $_.TaskPath -like \"*$query*\" } }",
        `$items | Select-Object -First ${Number(limit)} | ConvertTo-Json -Compress -Depth 5`,
      ].join("; ");
      const result = await runPowerShellScriptFile(script, "task-schedule-list");
      const parsed = result.stdout ? JSON.parse(result.stdout) : [];
      return json({ success: !result.error, tasks: Array.isArray(parsed) ? parsed : [parsed], stderr: result.stderr, error: result.error });
    }),
  }));

tools.push(tool({
    name: "as_task_schedule_create",
    description: "Create a scheduled command using Windows Task Scheduler or user crontab. Supports once, daily, and onlogon/reboot where the platform allows it.",
    parameters: {
      task_name: z.string(),
      schedule_type: z.enum(["once", "daily", "onlogon"]).default("daily"),
      command_line: z.string(),
      start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
      start_date: z.string().regex(/^$|^\d{1,2}\/\d{1,2}\/\d{4}$/).default(""),
      days_interval: z.number().int().min(1).max(365).default(1),
    },
    implementation: safeTool("as_task_schedule_create", async ({ task_name, schedule_type, command_line, start_time, start_date, days_interval }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const [hourText, minuteText] = String(start_time).split(":");
        const marker = `# agentic-studio:${encodeURIComponent(task_name as string)}`;
        let cronExpression = "";
        let note = "";
        if (schedule_type === "onlogon") {
          cronExpression = "@reboot";
        } else if (schedule_type === "once") {
          const date = String(start_date || "").trim() ? new Date(String(start_date)) : new Date();
          if (Number.isNaN(date.getTime())) throw new Error("start_date must be parseable for non-Windows once schedules.");
          cronExpression = `${Number(minuteText)} ${Number(hourText)} ${date.getDate()} ${date.getMonth() + 1} *`;
          note = "Cron has no native one-shot schedule; this entry matches the requested month/day and should be deleted after it runs.";
        } else {
          cronExpression = `${Number(minuteText)} ${Number(hourText)} */${Number(days_interval)} * *`;
        }
        const cronLine = `${cronExpression} ${String(command_line).replace(/\r?\n/g, " ")} ${marker}`;
        const current = await executeManagedCommand(ctl, "crontab -l", { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const existingLines = current.stdout && current.exitCode === 0 ? current.stdout.split(/\r?\n/).filter(Boolean) : [];
        const nextLines = existingLines.filter((line) => !line.includes(marker));
        nextLines.push(cronLine);
        const tmpPath = path.join(process.platform === "win32" ? workspaceRoot : "/tmp", `agentic-studio-cron-${Date.now()}.txt`);
        await fsp.writeFile(tmpPath, `${nextLines.join("\n")}\n`, "utf8");
        try {
          const result = await executeManagedCommand(ctl, `crontab ${quote(tmpPath)}`, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
          return json({ success: !result.error && result.exitCode === 0, taskName: task_name, cronLine, note, stdout: result.stdout, stderr: result.stderr, error: result.error, exitCode: result.exitCode });
        } finally {
          await fsp.rm(tmpPath, { force: true });
        }
      }
      const escapedTaskName = String(task_name).replace(/"/g, '""');
      const escapedCommandLine = String(command_line).replace(/"/g, '""');
      let command = `schtasks /Create /TN ${quote(escapedTaskName)} /TR ${quote(escapedCommandLine)} /F`;
      if (schedule_type === "onlogon") {
        command += " /SC ONLOGON";
      } else if (schedule_type === "once") {
        command += ` /SC ONCE /ST ${start_time as string}`;
        if ((start_date as string).trim()) command += ` /SD ${start_date as string}`;
      } else {
        command += ` /SC DAILY /ST ${start_time as string} /MO ${Number(days_interval)}`;
        if ((start_date as string).trim()) command += ` /SD ${start_date as string}`;
      }
      const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
      return buildCommandResponse(command, result);
    }),
  }));

tools.push(tool({
    name: "as_task_schedule_delete",
    description: "Delete a scheduled task by name from Windows Task Scheduler or user crontab.",
    parameters: {
      task_name: z.string(),
    },
    implementation: safeTool("as_task_schedule_delete", async ({ task_name }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const marker = `# agentic-studio:${encodeURIComponent(task_name as string)}`;
        const current = await executeManagedCommand(ctl, "crontab -l", { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const existingLines = current.stdout && current.exitCode === 0 ? current.stdout.split(/\r?\n/).filter(Boolean) : [];
        const nextLines = existingLines.filter((line) => !line.includes(marker));
        const tmpPath = path.join("/tmp", `agentic-studio-cron-${Date.now()}.txt`);
        await fsp.writeFile(tmpPath, `${nextLines.join("\n")}${nextLines.length ? "\n" : ""}`, "utf8");
        try {
          const result = await executeManagedCommand(ctl, `crontab ${quote(tmpPath)}`, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
          return json({ success: !result.error && result.exitCode === 0, taskName: task_name, removed: existingLines.length - nextLines.length, stdout: result.stdout, stderr: result.stderr, error: result.error, exitCode: result.exitCode });
        } finally {
          await fsp.rm(tmpPath, { force: true });
        }
      }
      const command = `schtasks /Delete /TN ${quote(String(task_name).replace(/"/g, '""'))} /F`;
      const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
      return buildCommandResponse(command, result);
    }),
  }));

tools.push(tool({
    name: "as_task_schedule_run",
    description: "Run a scheduled task immediately by name. On Linux/macOS, runs the command stored in the marked crontab entry.",
    parameters: {
      task_name: z.string(),
    },
    implementation: safeTool("as_task_schedule_run", async ({ task_name }) => {
      requireCommandExecution();
      if (process.platform !== "win32") {
        const marker = `# agentic-studio:${encodeURIComponent(task_name as string)}`;
        const current = await executeManagedCommand(ctl, "crontab -l", { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
        const line = (current.stdout || "").split(/\r?\n/).find((entry) => entry.includes(marker));
        if (!line) throw new Error(`Scheduled task '${task_name as string}' was not found in user crontab.`);
        const withoutMarker = line.replace(/\s*# agentic-studio:[^\s#]+\s*$/, "").trim();
        const command = withoutMarker.startsWith("@")
          ? withoutMarker.split(/\s+/).slice(1).join(" ")
          : withoutMarker.split(/\s+/).slice(5).join(" ");
        if (!command) throw new Error(`Unable to extract command for scheduled task '${task_name as string}'.`);
        const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 300000), maxOutputBytes);
        return buildCommandResponse(command, result);
      }
      const command = `schtasks /Run /TN ${quote(String(task_name).replace(/"/g, '""'))}`;
      const result = await executeManagedCommand(ctl, command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 120000), maxOutputBytes);
      return buildCommandResponse(command, result);
    }),
  }));
}
