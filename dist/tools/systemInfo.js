"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemInfoTool = registerSystemInfoTool;
function registerSystemInfoTool(ctx, tools) {
    const { tool, z, safeTool, workspaceRoot, getConversationStorageContext, runCommand, shell, env, timeoutMs, maxOutputBytes, process, os, pluginDataDirectory, pythonExecutable, powerShellCommand, resolveExecutablePath, fileExists, quote, path, fsp, asArray, toNumberOrNull, getNodeExecutablePath, getDenoExecutablePath, ctl, json, mergeDefined, } = ctx;
    tools.push(tool({
        name: "as_system_info",
        description: "Return system, hardware, storage, network, runtime, and workspace details. detailed=true adds expanded hardware and runtime telemetry. detailed='maximum' includes the richest available provider snapshots such as raw LibreHardwareMonitor hardware/sensor output when configured. fields or field_list can request one or many specific values by dot path or compact aliases so the caller does not have to fetch the entire payload just to inspect a few values.",
        parameters: {
            detailed: z.union([z.boolean(), z.enum(["maximum"])]).default(false),
            fields: z.string().default(""),
            field_list: z.array(z.string()).optional(),
            help: z.union([z.boolean(), z.string()]).default(false),
        },
        implementation: safeTool("as_system_info", async ({ detailed, fields, field_list, help }) => {
            const nonEmptyArray = (value) => Array.isArray(value) && value.length > 0 ? value : undefined;
            const nonEmptyObject = (value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 ? value : undefined;
            const nonEmptyValue = (value) => Array.isArray(value) ? nonEmptyArray(value) : nonEmptyObject(value) || (value ?? undefined);
            const parseRequestedFields = (...values) => {
                const parsed = [];
                for (const value of values) {
                    if (Array.isArray(value)) {
                        parsed.push(...value.map((entry) => String(entry ?? "").trim()).filter(Boolean));
                        continue;
                    }
                    const text = String(value ?? "").trim();
                    if (!text)
                        continue;
                    if (text.startsWith("[")) {
                        try {
                            const jsonParsed = JSON.parse(text);
                            if (Array.isArray(jsonParsed)) {
                                parsed.push(...jsonParsed.map((entry) => String(entry ?? "").trim()).filter(Boolean));
                                continue;
                            }
                        }
                        catch { }
                    }
                    parsed.push(...text.split(/[\r\n,]+/).map((entry) => entry.trim()).filter(Boolean));
                }
                return [...new Set(parsed)];
            };
            const requestedFields = parseRequestedFields(field_list, fields);
            const detailRank = (level) => level === "maximum" ? 2 : level === "detailed" ? 1 : 0;
            const explicitDetailLevel = detailed === "maximum" ? "maximum" : detailed ? "detailed" : "basic";
            const inferRequestedDetailLevel = (fieldNames) => {
                let level = "basic";
                for (const rawField of fieldNames) {
                    const fieldName = rawField.toLowerCase();
                    const normalizedFieldName = fieldName.replace(/[_-]+/g, " ");
                    if (/librehardwaremonitor|sensortelemetry|sensorreadings|rawsensors/.test(fieldName))
                        return "maximum";
                    if (/^(cpupackages|hardware|connectivity|disks|runtimes|processsummary|usersessions|networkinterfaces)\b/.test(fieldName))
                        level = "detailed";
                    if (/\b(cpu|gpu|drive|disk|temperature|fan|power|clock|pcie|vbios|voltage|load)\b/.test(normalizedFieldName))
                        level = "detailed";
                }
                return level;
            };
            const detailLevel = detailRank(inferRequestedDetailLevel(requestedFields)) > detailRank(explicitDetailLevel)
                ? inferRequestedDetailLevel(requestedFields)
                : explicitDetailLevel;
            const includeDetailed = detailLevel !== "basic";
            const includeMaximum = detailLevel === "maximum";
            const parseTelemetryText = (value) => {
                const text = String(value ?? "").trim();
                if (!text || /^\[(?:N\/A|Not Supported|Requested functionality has been deprecated)\]$/i.test(text))
                    return null;
                return text;
            };
            const parseTelemetryNumber = (value) => {
                const text = parseTelemetryText(value);
                if (text === null)
                    return null;
                const numeric = Number(text);
                return Number.isFinite(numeric) ? numeric : null;
            };
            const parseTelemetryBoolean = (value) => {
                const text = parseTelemetryText(value);
                if (text === null)
                    return null;
                if (/^(enabled|active|on|yes|true)$/i.test(text))
                    return true;
                if (/^(disabled|inactive|off|no|false)$/i.test(text))
                    return false;
                return null;
            };
            const normalizeGpuIdentity = (value) => String(value ?? "")
                .toLowerCase()
                .replace(/\(.*?\)/g, " ")
                .replace(/\b(nvidia|geforce|amd|radeon|intel)\b/g, " ")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();
            const summarizeHardwareMonitorGpuTelemetry = (entry) => {
                const sensors = asArray(entry.sensors).map((sensor) => ({
                    name: typeof sensor.name === "string" ? sensor.name : null,
                    sensorType: typeof sensor.sensorType === "string" ? sensor.sensorType : null,
                    value: toNumberOrNull(sensor.value),
                    min: toNumberOrNull(sensor.min),
                    max: toNumberOrNull(sensor.max),
                    identifier: typeof sensor.identifier === "string" ? sensor.identifier : null,
                }));
                const identifier = typeof entry.identifier === "string" ? entry.identifier : null;
                const indexMatch = identifier ? identifier.match(/\/gpu-[^/]+\/(\d+)/i) : null;
                const pickSensor = (sensorType, namePatterns) => sensors.find((sensor) => sensor.sensorType?.toLowerCase() === sensorType.toLowerCase()
                    && namePatterns.some((pattern) => pattern.test(String(sensor.name || ""))));
                const pickValue = (sensorType, namePatterns) => pickSensor(sensorType, namePatterns)?.value ?? null;
                const maxMatchingValue = (sensorType, namePatterns) => {
                    const values = sensors
                        .filter((sensor) => sensor.sensorType?.toLowerCase() === sensorType.toLowerCase()
                        && namePatterns.some((pattern) => pattern.test(String(sensor.name || ""))))
                        .map((sensor) => sensor.value)
                        .filter((value) => typeof value === "number" && Number.isFinite(value));
                    return values.length > 0 ? Math.max(...values) : null;
                };
                return {
                    source: typeof entry.source === "string" ? entry.source : null,
                    name: typeof entry.hardwareName === "string" ? entry.hardwareName : null,
                    identifier,
                    index: indexMatch ? Number(indexMatch[1]) : null,
                    temperatureC: pickValue("Temperature", [/gpu core/i, /^gpu$/i, /temperature/i]),
                    hotSpotTemperatureC: pickValue("Temperature", [/hot ?spot/i, /junction/i]),
                    fanSpeedRpm: maxMatchingValue("Fan", [/gpu|fan/i]),
                    fanSpeedPercent: maxMatchingValue("Control", [/gpu|fan/i]),
                    gpuUtilizationPercent: pickValue("Load", [/gpu core/i, /gpu/i, /\b3d\b/i, /d3d/i]),
                    memoryUtilizationPercent: pickValue("Load", [/memory/i]),
                    graphicsClockMHz: pickValue("Clock", [/gpu core/i, /graphics/i, /\bcore\b/i]),
                    memoryClockMHz: pickValue("Clock", [/memory/i]),
                    powerDrawW: pickValue("Power", [/gpu package/i, /package/i, /\bgpu\b/i]),
                    sensorReadings: sensors,
                };
            };
            const summarizeHardwareMonitorCpuTelemetry = (entry) => {
                const sensors = asArray(entry.sensors).map((sensor) => ({
                    name: typeof sensor.name === "string" ? sensor.name : null,
                    sensorType: typeof sensor.sensorType === "string" ? sensor.sensorType : null,
                    value: toNumberOrNull(sensor.value),
                    min: toNumberOrNull(sensor.min),
                    max: toNumberOrNull(sensor.max),
                    identifier: typeof sensor.identifier === "string" ? sensor.identifier : null,
                }));
                const pickSensor = (sensorType, namePatterns) => sensors.find((sensor) => sensor.sensorType?.toLowerCase() === sensorType.toLowerCase()
                    && namePatterns.some((pattern) => pattern.test(String(sensor.name || ""))));
                const pickValue = (sensorType, namePatterns) => pickSensor(sensorType, namePatterns)?.value ?? null;
                const maxMatchingValue = (sensorType, namePatterns) => {
                    const values = sensors
                        .filter((sensor) => sensor.sensorType?.toLowerCase() === sensorType.toLowerCase()
                        && namePatterns.some((pattern) => pattern.test(String(sensor.name || ""))))
                        .map((sensor) => sensor.value)
                        .filter((value) => typeof value === "number" && Number.isFinite(value));
                    return values.length > 0 ? Math.max(...values) : null;
                };
                return {
                    source: typeof entry.source === "string" ? entry.source : null,
                    name: typeof entry.hardwareName === "string" ? entry.hardwareName : null,
                    identifier: typeof entry.identifier === "string" ? entry.identifier : null,
                    packageTemperatureC: pickValue("Temperature", [/package/i, /cpu package/i, /tdie/i]),
                    maxCoreTemperatureC: maxMatchingValue("Temperature", [/core/i, /ccd/i, /die/i, /p-core/i, /e-core/i]),
                    totalLoadPercent: pickValue("Load", [/^cpu total$/i, /\btotal\b/i, /package/i]),
                    packagePowerW: pickValue("Power", [/package/i, /cpu package/i]),
                    coreVoltageV: pickValue("Voltage", [/vcore/i, /cpu cores?/i, /core/i]),
                    busClockMHz: pickValue("Clock", [/bus/i, /bclk/i]),
                    maxCoreClockMHz: maxMatchingValue("Clock", [/core/i, /p-core/i, /e-core/i]),
                    sensorReadings: sensors,
                };
            };
            const resolveStructuredPath = (root, rawPath) => {
                const pathText = String(rawPath || "").trim();
                if (!pathText)
                    return undefined;
                const segments = pathText.split(".").filter(Boolean);
                let current = [root];
                let expanded = false;
                for (const segment of segments) {
                    const match = segment.match(/^([^[\]]+)(?:\[(\d*)\])?$/);
                    if (!match)
                        return undefined;
                    const [, key, indexToken] = match;
                    const next = [];
                    for (const item of current) {
                        if (item == null || typeof item !== "object")
                            continue;
                        const value = item[key];
                        if (indexToken === undefined) {
                            if (value !== undefined)
                                next.push(value);
                            continue;
                        }
                        if (!Array.isArray(value))
                            continue;
                        expanded = true;
                        if (indexToken === "") {
                            next.push(...value);
                        }
                        else {
                            const numericIndex = Number(indexToken);
                            if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < value.length)
                                next.push(value[numericIndex]);
                        }
                    }
                    current = next;
                    if (current.length === 0)
                        return undefined;
                }
                if (expanded)
                    return current;
                return current.length <= 1 ? current[0] : current;
            };
            const buildDriveUsageSummary = (root) => asArray(root.disks).map((disk) => {
                const sizeBytes = toNumberOrNull(disk.Size);
                const freeBytes = toNumberOrNull(disk.FreeSpace);
                const usedBytes = sizeBytes !== null && freeBytes !== null ? Math.max(0, sizeBytes - freeBytes) : null;
                const usagePercent = sizeBytes && sizeBytes > 0 && usedBytes !== null ? Number(((usedBytes / sizeBytes) * 100).toFixed(2)) : null;
                return {
                    deviceId: disk.DeviceID || null,
                    volumeName: disk.VolumeName || null,
                    fileSystem: disk.FileSystem || null,
                    sizeBytes,
                    freeBytes,
                    usedBytes,
                    usagePercent,
                };
            });
            const buildGpuSummaries = (root) => asArray(resolveStructuredPath(root, "hardware.gpuAdapters"));
            const buildCpuSummaries = (root) => asArray(resolveStructuredPath(root, "cpuPackages"));
            const firstNonNull = (values) => values.find((value) => value !== null && value !== undefined);
            const mapDefined = (items, key) => items
                .map((item) => item[key])
                .filter((value) => value !== null && value !== undefined);
            const systemInfoAliasResolvers = {
                username: (payload) => resolveStructuredPath(payload, "userInfo.username"),
                current_username: (payload) => resolveStructuredPath(payload, "userInfo.username"),
                cpu_model: (payload) => firstNonNull(mapDefined(buildCpuSummaries(payload), "name")) ?? firstNonNull(mapDefined(asArray(payload.cpus), "model")),
                cpu_models: (payload) => {
                    const names = mapDefined(buildCpuSummaries(payload), "name");
                    return names.length > 0 ? names : mapDefined(asArray(payload.cpus), "model");
                },
                cpu_package_temperature_c: (payload) => firstNonNull(mapDefined(buildCpuSummaries(payload), "packageTemperatureC")),
                cpu_package_temperatures_c: (payload) => mapDefined(buildCpuSummaries(payload), "packageTemperatureC"),
                cpu_temperatures_c: (payload) => mapDefined(buildCpuSummaries(payload), "packageTemperatureC"),
                cpu_total_load_percent: (payload) => firstNonNull(mapDefined(buildCpuSummaries(payload), "totalLoadPercent")),
                cpu_total_loads_percent: (payload) => mapDefined(buildCpuSummaries(payload), "totalLoadPercent"),
                cpu_package_power_w: (payload) => firstNonNull(mapDefined(buildCpuSummaries(payload), "packagePowerW")),
                cpu_package_powers_w: (payload) => mapDefined(buildCpuSummaries(payload), "packagePowerW"),
                gpu_model: (payload) => firstNonNull(mapDefined(buildGpuSummaries(payload), "Name")),
                gpu_models: (payload) => mapDefined(buildGpuSummaries(payload), "Name"),
                gpu_temperature_c: (payload) => firstNonNull(mapDefined(buildGpuSummaries(payload), "temperatureC")),
                gpu_temperatures_c: (payload) => mapDefined(buildGpuSummaries(payload), "temperatureC"),
                gpu_hotspot_temperature_c: (payload) => firstNonNull(mapDefined(buildGpuSummaries(payload), "hotSpotTemperatureC")),
                gpu_hotspot_temperatures_c: (payload) => mapDefined(buildGpuSummaries(payload), "hotSpotTemperatureC"),
                gpu_fan_speed_percent: (payload) => firstNonNull(mapDefined(buildGpuSummaries(payload), "fanSpeedPercent")),
                gpu_fan_speeds_percent: (payload) => mapDefined(buildGpuSummaries(payload), "fanSpeedPercent"),
                gpu_fan_speed_rpm: (payload) => firstNonNull(mapDefined(buildGpuSummaries(payload), "fanSpeedRpm")),
                gpu_fan_speeds_rpm: (payload) => mapDefined(buildGpuSummaries(payload), "fanSpeedRpm"),
                gpu_power_draw_w: (payload) => firstNonNull(mapDefined(buildGpuSummaries(payload), "powerDrawW")),
                gpu_power_draws_w: (payload) => mapDefined(buildGpuSummaries(payload), "powerDrawW"),
                local_drives_usage: (payload) => buildDriveUsageSummary(payload),
                drive_usage: (payload) => buildDriveUsageSummary(payload),
            };
            const collectFieldDescriptors = (value, prefix = "", seen = new Set(), depth = 0) => {
                if (depth > 6 || value === null || value === undefined)
                    return [...seen];
                if (Array.isArray(value)) {
                    if (prefix)
                        seen.add(prefix);
                    const sample = value.find((entry) => entry !== null && entry !== undefined);
                    if (sample !== undefined)
                        collectFieldDescriptors(sample, `${prefix}[]`, seen, depth + 1);
                    return [...seen];
                }
                if (typeof value !== "object") {
                    if (prefix)
                        seen.add(prefix);
                    return [...seen];
                }
                if (prefix)
                    seen.add(prefix);
                for (const [key, child] of Object.entries(value)) {
                    const nextPrefix = prefix ? `${prefix}.${key}` : key;
                    seen.add(nextPrefix);
                    collectFieldDescriptors(child, nextPrefix, seen, depth + 1);
                }
                return [...seen];
            };
            const matchDescriptorPattern = (descriptor, pattern) => {
                const normalizedDescriptor = descriptor.toLowerCase().replace(/[_\-.]+/g, " ");
                const normalizedPattern = pattern.toLowerCase().replace(/[_\-.]+/g, " ").trim();
                return !normalizedPattern || normalizedDescriptor.includes(normalizedPattern);
            };
            const selectSystemInfoFields = (root, fieldNames) => {
                const selected = {};
                for (const fieldName of fieldNames) {
                    const aliasKey = fieldName.toLowerCase();
                    selected[fieldName] = systemInfoAliasResolvers[aliasKey]
                        ? systemInfoAliasResolvers[aliasKey](root)
                        : resolveStructuredPath(root, fieldName);
                }
                return selected;
            };
            const parseNvidiaSmiGpuTelemetry = (value) => value.split(/\r?\n/).filter(Boolean).map((line) => {
                const [index, name, uuid, pciBusId, pciDeviceId, pciSubDeviceId, driverVersion, vbiosVersion, serialNumber, memoryTotalMb, memoryUsedMb, memoryFreeMb, gpuUtilizationPercent, memoryUtilizationPercent, encoderUtilizationPercent, decoderUtilizationPercent, temperatureC, fanSpeedPercent, performanceState, powerDrawW, powerLimitW, graphicsClockMHz, memoryClockMHz, maxGraphicsClockMHz, maxMemoryClockMHz, pcieLinkGenerationCurrent, pcieLinkGenerationMax, pcieLinkWidthCurrent, pcieLinkWidthMax, displayMode, displayActive,] = line.split(",").map((part) => part.trim());
                return {
                    index: parseTelemetryNumber(index),
                    name: parseTelemetryText(name),
                    uuid: parseTelemetryText(uuid),
                    pciBusId: parseTelemetryText(pciBusId),
                    pciDeviceId: parseTelemetryText(pciDeviceId),
                    pciSubDeviceId: parseTelemetryText(pciSubDeviceId),
                    driverVersion: parseTelemetryText(driverVersion),
                    vbiosVersion: parseTelemetryText(vbiosVersion),
                    serialNumber: parseTelemetryText(serialNumber),
                    memoryTotalMb: parseTelemetryNumber(memoryTotalMb),
                    memoryUsedMb: parseTelemetryNumber(memoryUsedMb),
                    memoryFreeMb: parseTelemetryNumber(memoryFreeMb),
                    gpuUtilizationPercent: parseTelemetryNumber(gpuUtilizationPercent),
                    memoryUtilizationPercent: parseTelemetryNumber(memoryUtilizationPercent),
                    encoderUtilizationPercent: parseTelemetryNumber(encoderUtilizationPercent),
                    decoderUtilizationPercent: parseTelemetryNumber(decoderUtilizationPercent),
                    temperatureC: parseTelemetryNumber(temperatureC),
                    fanSpeedPercent: parseTelemetryNumber(fanSpeedPercent),
                    performanceState: parseTelemetryText(performanceState),
                    powerDrawW: parseTelemetryNumber(powerDrawW),
                    powerLimitW: parseTelemetryNumber(powerLimitW),
                    graphicsClockMHz: parseTelemetryNumber(graphicsClockMHz),
                    memoryClockMHz: parseTelemetryNumber(memoryClockMHz),
                    maxGraphicsClockMHz: parseTelemetryNumber(maxGraphicsClockMHz),
                    maxMemoryClockMHz: parseTelemetryNumber(maxMemoryClockMHz),
                    pcieLinkGenerationCurrent: parseTelemetryNumber(pcieLinkGenerationCurrent),
                    pcieLinkGenerationMax: parseTelemetryNumber(pcieLinkGenerationMax),
                    pcieLinkWidthCurrent: parseTelemetryNumber(pcieLinkWidthCurrent),
                    pcieLinkWidthMax: parseTelemetryNumber(pcieLinkWidthMax),
                    displayMode: parseTelemetryText(displayMode),
                    displayActive: parseTelemetryBoolean(displayActive),
                };
            });
            const storageContext = await getConversationStorageContext(workspaceRoot);
            const safeJsonCommand = async (command, parser = (value) => JSON.parse(value)) => {
                try {
                    const result = await runCommand(command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
                    if (!result.stdout)
                        return null;
                    return parser(result.stdout);
                }
                catch {
                    return null;
                }
            };
            const safeTextCommand = async (command) => {
                try {
                    const result = await runCommand(command, { cwd: workspaceRoot, shell, env }, Math.max(timeoutMs, 15000), maxOutputBytes);
                    const text = result.stdout.trim();
                    return text || null;
                }
                catch {
                    return null;
                }
            };
            const runPowerShellScriptFile = async (scriptContents, prefix) => {
                const tempDirectory = path.join(workspaceRoot, "screenshots", "tool-temp");
                await fsp.mkdir(tempDirectory, { recursive: true });
                const scriptPath = path.join(tempDirectory, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`);
                await fsp.writeFile(scriptPath, scriptContents, "utf8");
                const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${quote(scriptPath)}`;
                try {
                    const result = await runCommand(command, { cwd: workspaceRoot, shell, env }, timeoutMs, maxOutputBytes);
                    return result.stdout || null;
                }
                catch {
                    return null;
                }
                finally {
                    await fsp.rm(scriptPath, { force: true }).catch(() => { });
                }
            };
            const escapePowerShellSingleQuoted = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;
            const readLibreHardwareMonitorSnapshot = async (executablePath) => {
                const tempDirectory = path.join(workspaceRoot, "screenshots", "tool-temp");
                await fsp.mkdir(tempDirectory, { recursive: true });
                const outputPath = path.join(tempDirectory, `system-info-lhm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
                await runPowerShellScriptFile([
                    `$exePath = ${escapePowerShellSingleQuoted(executablePath)}`,
                    `$outputPath = ${escapePowerShellSingleQuoted(outputPath)}`,
                    "$baseDir = Split-Path -Path $exePath -Parent",
                    "$candidates = @(",
                    "  (Join-Path $baseDir 'LibreHardwareMonitorLib.dll'),",
                    "  (Join-Path $baseDir 'lib\\LibreHardwareMonitorLib.dll')",
                    ")",
                    "$dllPath = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1)",
                    "if (-not $dllPath) { throw 'LibreHardwareMonitorLib.dll was not found next to the configured LibreHardwareMonitor executable.' }",
                    "[System.Reflection.Assembly]::UnsafeLoadFrom($dllPath) | Out-Null",
                    "$computer = New-Object LibreHardwareMonitor.Hardware.Computer",
                    "try { $computer.IsCpuEnabled = $true } catch {}",
                    "$computer.IsGpuEnabled = $true",
                    "try { $computer.IsMemoryEnabled = $true } catch {}",
                    "try { $computer.IsMotherboardEnabled = $true } catch {}",
                    "try { $computer.IsControllerEnabled = $true } catch {}",
                    "try { $computer.IsStorageEnabled = $true } catch {}",
                    "try { $computer.IsNetworkEnabled = $true } catch {}",
                    "try { $computer.IsBatteryEnabled = $true } catch {}",
                    "try { $computer.IsPsuEnabled = $true } catch {}",
                    "$computer.Open()",
                    "function Get-LhmSensors($hardware) {",
                    "  $items = @()",
                    "  foreach ($sensor in @($hardware.Sensors)) {",
                    "    $items += [pscustomobject]@{",
                    "      name = [string]$sensor.Name",
                    "      sensorType = [string]$sensor.SensorType",
                    "      value = $sensor.Value",
                    "      min = $sensor.Min",
                    "      max = $sensor.Max",
                    "      identifier = [string]$sensor.Identifier",
                    "    }",
                    "  }",
                    "  foreach ($subHardware in @($hardware.SubHardware)) {",
                    "    $subHardware.Update()",
                    "    $items += @(Get-LhmSensors $subHardware)",
                    "  }",
                    "  return $items",
                    "}",
                    "try {",
                    "  $items = foreach ($hardware in @($computer.Hardware)) {",
                    "    $hardware.Update()",
                    "    [pscustomobject]@{",
                    "      source = 'librehardwaremonitor'",
                    "      identifier = [string]$hardware.Identifier",
                    "      hardwareName = [string]$hardware.Name",
                    "      hardwareType = [string]$hardware.HardwareType",
                    "      sensors = @(Get-LhmSensors $hardware)",
                    "    }",
                    "  }",
                    "  $items | ConvertTo-Json -Compress -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding UTF8",
                    "  Write-Output $outputPath",
                    "} finally {",
                    "  $computer.Close()",
                    "}",
                ].join("\n"), "system-info-lhm");
                try {
                    const text = (await fsp.readFile(outputPath, "utf8")).replace(/^\uFEFF/, "");
                    return text.trim() ? JSON.parse(text) : null;
                }
                catch {
                    return null;
                }
                finally {
                    await fsp.rm(outputPath, { force: true }).catch(() => { });
                }
            };
            const cpuInventory = os.cpus();
            const cpuModelCounts = new Map();
            for (const cpu of cpuInventory) {
                cpuModelCounts.set(cpu.model, (cpuModelCounts.get(cpu.model) || 0) + 1);
            }
            const baseInfo = {
                platform: process.platform,
                arch: process.arch,
                hostname: os.hostname(),
                release: os.release(),
                version: os.version?.() || null,
                userInfo: (() => {
                    try {
                        const info = os.userInfo();
                        return { username: info.username, homedir: info.homedir };
                    }
                    catch {
                        return null;
                    }
                })(),
                uptimeSeconds: os.uptime(),
                cpus: [...cpuModelCounts.entries()].map(([model, count]) => count > 1 ? { model, count } : { model }),
                cpuCount: cpuInventory.length,
                totalMemoryBytes: os.totalmem(),
                freeMemoryBytes: os.freemem(),
                homeDirectory: os.homedir(),
                tempDirectory: os.tmpdir(),
                nodeVersion: process.version,
                pid: process.pid,
                workspaceRoot,
                pluginDataRoot: pluginDataDirectory(),
                shell,
                pythonExecutable,
                conversation: mergeDefined({
                    id: storageContext.conversationId,
                    folder: storageContext.conversationFolderPath || undefined,
                    mode: storageContext.mode,
                }),
            };
            let disks = null;
            let physicalDisks = null;
            let processors = null;
            let gpuAdapters = null;
            let gpuTelemetry = null;
            let gpuSensorTelemetry = null;
            let cpuSensorTelemetry = null;
            let libreHardwareMonitorSnapshot = null;
            let cpuUsage = null;
            let systemLoad = null;
            let motherboard = null;
            let userSessions = null;
            let processSummary = null;
            let bluetooth = null;
            let networkAdapters = null;
            let networkInterfaces = null;
            let networkUsage = null;
            let publicIp = null;
            let monitors = null;
            let displayDevices = null;
            if (process.platform === "win32") {
                disks = await safeJsonCommand(powerShellCommand("$logical = Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,FileSystem,Size,FreeSpace; $logical | ConvertTo-Json -Compress"));
                physicalDisks = await safeJsonCommand(powerShellCommand("Get-PhysicalDisk | Select-Object FriendlyName,SerialNumber,MediaType,BusType,HealthStatus,Size,AllocatedSize,PhysicalSectorSize,LogicalSectorSize | ConvertTo-Json -Compress"));
                processors = await safeJsonCommand(powerShellCommand("$items = Get-CimInstance Win32_Processor | Select-Object DeviceID,Name,Manufacturer,Description,SocketDesignation,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,ProcessorId; $items | ConvertTo-Json -Compress"));
                gpuAdapters = await safeJsonCommand(powerShellCommand("Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor,Status,PNPDeviceID | ConvertTo-Json -Compress"));
                displayDevices = await safeJsonCommand(powerShellCommand("Get-PnpDevice -Class Display -ErrorAction SilentlyContinue | Select-Object FriendlyName,InstanceId,Status,Class,Manufacturer | ConvertTo-Json -Compress"));
                monitors = await (async () => {
                    const stdout = await runPowerShellScriptFile([
                        "Add-Type -AssemblyName System.Windows.Forms",
                        "$sig = @'",
                        "using System;",
                        "using System.Runtime.InteropServices;",
                        "public static class DisplaySettingsNative {",
                        "  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]",
                        "  public struct DEVMODE {",
                        "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;",
                        "    public short dmSpecVersion;",
                        "    public short dmDriverVersion;",
                        "    public short dmSize;",
                        "    public short dmDriverExtra;",
                        "    public int dmFields;",
                        "    public int dmPositionX;",
                        "    public int dmPositionY;",
                        "    public int dmDisplayOrientation;",
                        "    public int dmDisplayFixedOutput;",
                        "    public short dmColor;",
                        "    public short dmDuplex;",
                        "    public short dmYResolution;",
                        "    public short dmTTOption;",
                        "    public short dmCollate;",
                        "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;",
                        "    public short dmLogPixels;",
                        "    public int dmBitsPerPel;",
                        "    public int dmPelsWidth;",
                        "    public int dmPelsHeight;",
                        "    public int dmDisplayFlags;",
                        "    public int dmDisplayFrequency;",
                        "    public int dmICMMethod;",
                        "    public int dmICMIntent;",
                        "    public int dmMediaType;",
                        "    public int dmDitherType;",
                        "    public int dmReserved1;",
                        "    public int dmReserved2;",
                        "    public int dmPanningWidth;",
                        "    public int dmPanningHeight;",
                        "  }",
                        "  [DllImport(\"user32.dll\", CharSet = CharSet.Ansi)]",
                        "  public static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);",
                        "}",
                        "'@",
                        "Add-Type $sig",
                        "$ENUM_CURRENT_SETTINGS = -1",
                        "$monitorIds = @(Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue)",
                        "$items = foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {",
                        "  $monitor = $null",
                        "  if ($monitorIds.Count -gt 0) {",
                        "    $monitor = $monitorIds[[array]::IndexOf([System.Windows.Forms.Screen]::AllScreens, $screen)]",
                        "  }",
                        "  $friendlyName = if ($monitor) { -join ($monitor.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) } else { $null }",
                        "  $manufacturerCode = if ($monitor) { -join ($monitor.ManufacturerName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) } else { $null }",
                        "  $serialNumber = if ($monitor) { -join ($monitor.SerialNumberID | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) } else { $null }",
                        "  $devMode = New-Object DisplaySettingsNative+DEVMODE",
                        "  $devMode.dmSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][DisplaySettingsNative+DEVMODE])",
                        "  $ok = [DisplaySettingsNative]::EnumDisplaySettings($screen.DeviceName, $ENUM_CURRENT_SETTINGS, [ref]$devMode)",
                        "  [pscustomobject]@{",
                        "    name = if ($friendlyName) { $friendlyName } else { $screen.DeviceName }",
                        "    friendlyName = $friendlyName",
                        "    manufacturerCode = $manufacturerCode",
                        "    serialNumber = $serialNumber",
                        "    deviceName = $screen.DeviceName",
                        "    primary = $screen.Primary",
                        "    width = $screen.Bounds.Width",
                        "    height = $screen.Bounds.Height",
                        "    resolution = \"$($screen.Bounds.Width)x$($screen.Bounds.Height)\"",
                        "    boundsX = $screen.Bounds.X",
                        "    boundsY = $screen.Bounds.Y",
                        "    refreshRateHz = if ($ok) { $devMode.dmDisplayFrequency } else { $null }",
                        "  }",
                        "}",
                        "$items | ConvertTo-Json -Compress -Depth 4",
                    ].join("\n"), "system-info-monitors");
                    if (!stdout)
                        return null;
                    try {
                        return JSON.parse(stdout);
                    }
                    catch {
                        return null;
                    }
                })();
                motherboard = await safeJsonCommand(powerShellCommand("Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,SerialNumber,Version | ConvertTo-Json -Compress"));
                cpuUsage = await safeJsonCommand(powerShellCommand("(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples | Select-Object -ExpandProperty CookedValue | ConvertTo-Json -Compress"), (value) => Number(value));
                systemLoad = await safeJsonCommand(powerShellCommand("$os = Get-CimInstance Win32_OperatingSystem; $cs = Get-CimInstance Win32_ComputerSystem; [pscustomobject]@{ TotalVisibleMemoryKB=$os.TotalVisibleMemorySize; FreePhysicalMemoryKB=$os.FreePhysicalMemory; TotalVirtualMemoryKB=$os.TotalVirtualMemorySize; FreeVirtualMemoryKB=$os.FreeVirtualMemory; NumberOfProcesses=$os.NumberOfProcesses; NumberOfUsers=$os.NumberOfUsers; TotalSwapKB=$os.SizeStoredInPagingFiles; Manufacturer=$cs.Manufacturer; Model=$cs.Model; NumberOfProcessors=$cs.NumberOfProcessors; NumberOfLogicalProcessors=$cs.NumberOfLogicalProcessors } | ConvertTo-Json -Compress"));
                processSummary = await safeJsonCommand(powerShellCommand("$procs = Get-Process; [pscustomobject]@{ ProcessCount=$procs.Count; ThreadCount=(($procs | ForEach-Object { $_.Threads.Count } | Measure-Object -Sum).Sum); HandleCount=(($procs | Measure-Object Handles -Sum).Sum) } | ConvertTo-Json -Compress"));
                networkAdapters = await safeJsonCommand(powerShellCommand("Get-NetAdapter | Sort-Object Name | Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress,MediaType,PhysicalMediaType,DriverInformation | ConvertTo-Json -Compress"));
                networkUsage = await safeJsonCommand(powerShellCommand("$before = Get-NetAdapterStatistics | Select-Object Name,ReceivedBytes,SentBytes; Start-Sleep -Milliseconds 1000; $after = Get-NetAdapterStatistics | Select-Object Name,ReceivedBytes,SentBytes; $result = foreach ($entry in $after) { $prev = $before | Where-Object Name -eq $entry.Name | Select-Object -First 1; if ($prev) { [pscustomobject]@{ Name=$entry.Name; ReceivedBytes=$entry.ReceivedBytes; SentBytes=$entry.SentBytes; ReceiveBytesPerSecond=[math]::Max(0, [double]($entry.ReceivedBytes - $prev.ReceivedBytes)); SendBytesPerSecond=[math]::Max(0, [double]($entry.SentBytes - $prev.SentBytes)) } } }; $result | ConvertTo-Json -Compress"));
                bluetooth = await safeJsonCommand(powerShellCommand("Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status,Class,Manufacturer | ConvertTo-Json -Compress"));
                userSessions = await safeJsonCommand(powerShellCommand("Get-CimInstance Win32_LoggedOnUser | Select-Object Antecedent,Dependent | ConvertTo-Json -Compress"));
                const nvidiaSmi = await resolveExecutablePath(ctl, env, "__nvidiaSmi__", "nvidia-smi");
                if ((path.isAbsolute(nvidiaSmi) && await fileExists(nvidiaSmi)) || nvidiaSmi === "nvidia-smi") {
                    const nvidiaCommand = path.isAbsolute(nvidiaSmi)
                        ? powerShellCommand(`& ${quote(nvidiaSmi)} --query-gpu=index,name,uuid,pci.bus_id,pci.device_id,pci.sub_device_id,driver_version,vbios_version,serial,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,utilization.encoder,utilization.decoder,temperature.gpu,fan.speed,pstate,power.draw,power.limit,clocks.current.graphics,clocks.current.memory,clocks.max.graphics,clocks.max.memory,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max,display_mode,display_active --format=csv,noheader,nounits`)
                        : `${nvidiaSmi} --query-gpu=index,name,uuid,pci.bus_id,pci.device_id,pci.sub_device_id,driver_version,vbios_version,serial,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,utilization.encoder,utilization.decoder,temperature.gpu,fan.speed,pstate,power.draw,power.limit,clocks.current.graphics,clocks.current.memory,clocks.max.graphics,clocks.max.memory,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max,display_mode,display_active --format=csv,noheader,nounits`;
                    gpuTelemetry = await safeJsonCommand(nvidiaCommand, parseNvidiaSmiGpuTelemetry);
                }
                const libreHardwareMonitorPath = await resolveExecutablePath(ctl, env, "libreHardwareMonitorPath", "LibreHardwareMonitor.exe");
                if (path.isAbsolute(libreHardwareMonitorPath) && await fileExists(libreHardwareMonitorPath)) {
                    libreHardwareMonitorSnapshot = await readLibreHardwareMonitorSnapshot(libreHardwareMonitorPath);
                    const libreHardwareItems = asArray(libreHardwareMonitorSnapshot);
                    gpuSensorTelemetry = libreHardwareItems.filter((entry) => /^Gpu/i.test(String(entry.hardwareType || "")));
                    cpuSensorTelemetry = libreHardwareItems.filter((entry) => /^Cpu/i.test(String(entry.hardwareType || "")));
                }
                publicIp = await safeTextCommand(powerShellCommand("try { (Invoke-RestMethod -UseBasicParsing -Uri 'https://api.ipify.org?format=json' -TimeoutSec 5).ip } catch { try { Resolve-DnsName -Name myip.opendns.com -Server resolver1.opendns.com -Type A -ErrorAction Stop | Select-Object -First 1 -ExpandProperty IPAddress } catch { '' } }"));
            }
            else if (process.platform === "linux") {
                disks = await safeJsonCommand("lsblk -b -J -o NAME,PATH,TYPE,FSTYPE,SIZE,FSAVAIL,FSUSED,MODEL,TRAN,SERIAL,MOUNTPOINT");
                gpuTelemetry = await safeJsonCommand("nvidia-smi --query-gpu=index,name,uuid,pci.bus_id,pci.device_id,pci.sub_device_id,driver_version,vbios_version,serial,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,utilization.encoder,utilization.decoder,temperature.gpu,fan.speed,pstate,power.draw,power.limit,clocks.current.graphics,clocks.current.memory,clocks.max.graphics,clocks.max.memory,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max,display_mode,display_active --format=csv,noheader,nounits", parseNvidiaSmiGpuTelemetry);
                networkAdapters = await safeJsonCommand("ip -j address");
                processSummary = await safeJsonCommand("sh -lc \"printf '{\\\"processCount\\\":%s,\\\"threadCount\\\":%s}' \\\"$(ps -e --no-headers | wc -l)\\\" \\\"$(ps -eLo tid= | wc -l)\\\"\"");
                publicIp = await safeTextCommand("sh -lc \"curl -fsSL --max-time 5 https://api.ipify.org || dig +short myip.opendns.com @resolver1.opendns.com | head -n 1\"");
            }
            else if (process.platform === "darwin") {
                gpuAdapters = await safeJsonCommand("system_profiler SPDisplaysDataType -json");
                disks = await safeJsonCommand("system_profiler SPStorageDataType -json");
                motherboard = await safeJsonCommand("system_profiler SPHardwareDataType -json");
                networkAdapters = await safeJsonCommand("system_profiler SPNetworkDataType -json");
                processSummary = await safeJsonCommand("sh -lc \"printf '{\\\"processCount\\\":%s,\\\"threadCount\\\":%s}' \\\"$(ps -A | wc -l)\\\" \\\"$(ps -AM | wc -l)\\\"\"");
                publicIp = await safeTextCommand("sh -lc \"curl -fsSL --max-time 5 https://api.ipify.org || dig +short myip.opendns.com @resolver1.opendns.com | head -n 1\"");
            }
            if (includeDetailed) {
                networkInterfaces = Object.fromEntries(Object.entries(os.networkInterfaces()).map(([name, values]) => [name, (values || []).map((entry) => ({
                        family: entry.family,
                        address: entry.address,
                        internal: entry.internal,
                        mac: entry.mac,
                        cidr: entry.cidr,
                    }))]));
            }
            const processorEntries = asArray(processors);
            const inferredProcessorCount = toNumberOrNull(systemLoad?.NumberOfProcessors) ?? null;
            const cpuPackages = processorEntries.length > 0
                ? processorEntries.map((entry, index) => ({
                    id: String(entry.DeviceID || `CPU${index}`),
                    label: `CPU${index}`,
                    name: entry.Name || null,
                    manufacturer: entry.Manufacturer || null,
                    socket: entry.SocketDesignation || null,
                    cores: toNumberOrNull(entry.NumberOfCores),
                    logicalProcessors: toNumberOrNull(entry.NumberOfLogicalProcessors),
                    maxClockMHz: toNumberOrNull(entry.MaxClockSpeed),
                    currentClockMHz: toNumberOrNull(entry.CurrentClockSpeed),
                    processorId: entry.ProcessorId || null,
                }))
                : inferredProcessorCount && inferredProcessorCount > 0
                    ? Array.from({ length: inferredProcessorCount }, (_, index) => ({
                        id: `CPU${index}`,
                        label: `CPU${index}`,
                        name: baseInfo.cpus[0] || null,
                        manufacturer: null,
                        socket: null,
                        cores: null,
                        logicalProcessors: null,
                        maxClockMHz: null,
                        currentClockMHz: null,
                        processorId: null,
                    }))
                    : [];
            const normalizedCpuSensorTelemetry = asArray(cpuSensorTelemetry).map((entry) => summarizeHardwareMonitorCpuTelemetry(entry));
            const enrichedCpuPackages = cpuPackages.map((entry, index) => {
                const sensorTelemetry = normalizedCpuSensorTelemetry[index] || null;
                return {
                    ...entry,
                    packageTemperatureC: toNumberOrNull(sensorTelemetry?.packageTemperatureC) ?? null,
                    maxCoreTemperatureC: toNumberOrNull(sensorTelemetry?.maxCoreTemperatureC) ?? null,
                    totalLoadPercent: toNumberOrNull(sensorTelemetry?.totalLoadPercent) ?? null,
                    packagePowerW: toNumberOrNull(sensorTelemetry?.packagePowerW) ?? null,
                    coreVoltageV: toNumberOrNull(sensorTelemetry?.coreVoltageV) ?? null,
                    busClockMHz: toNumberOrNull(sensorTelemetry?.busClockMHz) ?? null,
                    maxCoreClockMHz: toNumberOrNull(sensorTelemetry?.maxCoreClockMHz) ?? null,
                    sensorTelemetrySource: typeof sensorTelemetry?.source === "string" ? sensorTelemetry.source : null,
                    sensorReadings: Array.isArray(sensorTelemetry?.sensorReadings) && sensorTelemetry.sensorReadings.length > 0 ? sensorTelemetry.sensorReadings : undefined,
                };
            });
            const normalizedGpuAdapters = asArray(gpuAdapters);
            const normalizedGpuTelemetry = asArray(gpuTelemetry);
            const normalizedGpuSensorTelemetry = asArray(gpuSensorTelemetry).map((entry) => summarizeHardwareMonitorGpuTelemetry(entry));
            const normalizedDisplayDevices = asArray(displayDevices);
            const displayDeviceByInstanceId = new Map(normalizedDisplayDevices
                .map((entry) => {
                const instanceId = String(entry.InstanceId || "").trim();
                return instanceId ? [instanceId.toUpperCase(), entry] : null;
            })
                .filter((entry) => Boolean(entry)));
            const gpuSensorTelemetryByName = new Map(normalizedGpuSensorTelemetry
                .map((entry) => {
                const key = normalizeGpuIdentity(entry.name || "");
                return key ? [key, entry] : null;
            })
                .filter((entry) => Boolean(entry)));
            const gpuSensorTelemetryByIndex = new Map(normalizedGpuSensorTelemetry
                .map((entry) => {
                const index = toNumberOrNull(entry.index);
                return index !== null ? [index, entry] : null;
            })
                .filter((entry) => Boolean(entry)));
            const enrichedGpuAdapters = normalizedGpuAdapters.map((entry, index) => {
                const telemetry = normalizedGpuTelemetry[index] || null;
                const adapterName = normalizeGpuIdentity(entry.Name || "");
                const sensorTelemetry = gpuSensorTelemetryByIndex.get(index)
                    || (adapterName && gpuSensorTelemetryByName.get(adapterName))
                    || normalizedGpuSensorTelemetry[index]
                    || null;
                const telemetryFanSpeedPercent = toNumberOrNull(telemetry?.fanSpeedPercent);
                const sensorFanSpeedPercent = toNumberOrNull(sensorTelemetry?.fanSpeedPercent);
                const telemetryMemoryTotalMb = toNumberOrNull(telemetry?.memoryTotalMb);
                const adapterRamBytes = telemetryMemoryTotalMb !== null
                    ? telemetryMemoryTotalMb * 1024 * 1024
                    : toNumberOrNull(entry.AdapterRAM);
                const pnpDeviceId = String(entry.PNPDeviceID || "").trim();
                const matchingDisplayDevice = pnpDeviceId ? displayDeviceByInstanceId.get(pnpDeviceId.toUpperCase()) || null : null;
                const friendlyName = typeof matchingDisplayDevice?.FriendlyName === "string" && matchingDisplayDevice.FriendlyName.trim()
                    ? matchingDisplayDevice.FriendlyName.trim()
                    : null;
                const displayMemory = telemetryMemoryTotalMb !== null
                    ? `${Number((telemetryMemoryTotalMb / 1024).toFixed(2))} GiB${friendlyName ? ` (${friendlyName})` : ""}`
                    : adapterRamBytes !== null
                        ? `${Number((adapterRamBytes / (1024 ** 3)).toFixed(2))} GiB${friendlyName ? ` (${friendlyName})` : ""}`
                        : null;
                const { AdapterRAM, PNPDeviceID, ...adapterRest } = entry;
                return {
                    ...adapterRest,
                    pnpDeviceId: pnpDeviceId || null,
                    adapterRamBytes,
                    adapterRamGiB: adapterRamBytes !== null ? Number((adapterRamBytes / (1024 ** 3)).toFixed(2)) : null,
                    memoryTotalMb: telemetryMemoryTotalMb ?? null,
                    memoryTotalGiB: telemetryMemoryTotalMb !== null
                        ? Number((telemetryMemoryTotalMb / 1024).toFixed(2))
                        : null,
                    friendlyName,
                    displayMemory,
                    memoryUsedMb: toNumberOrNull(telemetry?.memoryUsedMb) ?? null,
                    memoryFreeMb: toNumberOrNull(telemetry?.memoryFreeMb) ?? null,
                    gpuUtilizationPercent: toNumberOrNull(telemetry?.gpuUtilizationPercent) ?? toNumberOrNull(sensorTelemetry?.gpuUtilizationPercent) ?? null,
                    memoryUtilizationPercent: toNumberOrNull(telemetry?.memoryUtilizationPercent) ?? toNumberOrNull(sensorTelemetry?.memoryUtilizationPercent) ?? null,
                    encoderUtilizationPercent: toNumberOrNull(telemetry?.encoderUtilizationPercent) ?? null,
                    decoderUtilizationPercent: toNumberOrNull(telemetry?.decoderUtilizationPercent) ?? null,
                    temperatureC: toNumberOrNull(telemetry?.temperatureC) ?? toNumberOrNull(sensorTelemetry?.temperatureC) ?? null,
                    hotSpotTemperatureC: toNumberOrNull(sensorTelemetry?.hotSpotTemperatureC) ?? null,
                    fanSpeedPercent: telemetryFanSpeedPercent !== null && telemetryFanSpeedPercent > 0
                        ? telemetryFanSpeedPercent
                        : sensorFanSpeedPercent ?? telemetryFanSpeedPercent ?? null,
                    fanSpeedRpm: toNumberOrNull(sensorTelemetry?.fanSpeedRpm) ?? null,
                    performanceState: typeof telemetry?.performanceState === "string" ? telemetry.performanceState : null,
                    powerDrawW: toNumberOrNull(telemetry?.powerDrawW) ?? toNumberOrNull(sensorTelemetry?.powerDrawW) ?? null,
                    powerLimitW: toNumberOrNull(telemetry?.powerLimitW) ?? null,
                    graphicsClockMHz: toNumberOrNull(telemetry?.graphicsClockMHz) ?? toNumberOrNull(sensorTelemetry?.graphicsClockMHz) ?? null,
                    memoryClockMHz: toNumberOrNull(telemetry?.memoryClockMHz) ?? toNumberOrNull(sensorTelemetry?.memoryClockMHz) ?? null,
                    maxGraphicsClockMHz: toNumberOrNull(telemetry?.maxGraphicsClockMHz) ?? null,
                    maxMemoryClockMHz: toNumberOrNull(telemetry?.maxMemoryClockMHz) ?? null,
                    pcieLinkGenerationCurrent: toNumberOrNull(telemetry?.pcieLinkGenerationCurrent) ?? null,
                    pcieLinkGenerationMax: toNumberOrNull(telemetry?.pcieLinkGenerationMax) ?? null,
                    pcieLinkWidthCurrent: toNumberOrNull(telemetry?.pcieLinkWidthCurrent) ?? null,
                    pcieLinkWidthMax: toNumberOrNull(telemetry?.pcieLinkWidthMax) ?? null,
                    vbiosVersion: typeof telemetry?.vbiosVersion === "string" ? telemetry.vbiosVersion : null,
                    serialNumber: typeof telemetry?.serialNumber === "string" ? telemetry.serialNumber : null,
                    pciBusId: typeof telemetry?.pciBusId === "string" ? telemetry.pciBusId : null,
                    pciDeviceId: typeof telemetry?.pciDeviceId === "string" ? telemetry.pciDeviceId : null,
                    pciSubDeviceId: typeof telemetry?.pciSubDeviceId === "string" ? telemetry.pciSubDeviceId : null,
                    displayMode: typeof telemetry?.displayMode === "string" ? telemetry.displayMode : null,
                    displayActive: typeof telemetry?.displayActive === "boolean" ? telemetry.displayActive : null,
                    sensorTelemetrySource: typeof sensorTelemetry?.source === "string" ? sensorTelemetry.source : null,
                    sensorReadings: Array.isArray(sensorTelemetry?.sensorReadings) && sensorTelemetry.sensorReadings.length > 0 ? sensorTelemetry.sensorReadings : undefined,
                    memorySource: telemetry ? "nvidia-smi" : "wmi",
                    telemetrySource: telemetry ? "nvidia-smi" : (typeof sensorTelemetry?.source === "string" ? sensorTelemetry.source : null),
                };
            });
            const normalizedDisks = asArray(disks);
            const normalizedPhysicalDisks = asArray(physicalDisks);
            const normalizedNetworkAdapters = asArray(networkAdapters);
            const normalizedNetworkUsage = asArray(networkUsage);
            const normalizedMonitors = asArray(monitors).map((entry) => ({
                name: entry.name || entry.friendlyName || entry.deviceName || null,
                friendlyName: entry.friendlyName || null,
                manufacturerCode: entry.manufacturerCode || null,
                serialNumber: entry.serialNumber || null,
                deviceName: entry.deviceName || null,
                primary: Boolean(entry.primary),
                resolution: entry.resolution || ((entry.width && entry.height) ? `${entry.width}x${entry.height}` : null),
                width: toNumberOrNull(entry.width),
                height: toNumberOrNull(entry.height),
                refreshRateHz: toNumberOrNull(entry.refreshRateHz),
                boundsX: toNumberOrNull(entry.boundsX),
                boundsY: toNumberOrNull(entry.boundsY),
            }));
            const hardware = includeDetailed ? mergeDefined({
                motherboard: motherboard || undefined,
                gpuAdapters: nonEmptyArray(enrichedGpuAdapters),
                cpuSensorTelemetry: nonEmptyArray(normalizedCpuSensorTelemetry),
                monitors: nonEmptyArray(normalizedMonitors),
                gpuTelemetry: nonEmptyArray(normalizedGpuTelemetry),
                gpuSensorTelemetry: nonEmptyArray(normalizedGpuSensorTelemetry),
                libreHardwareMonitor: includeMaximum ? nonEmptyObject({
                    source: "librehardwaremonitor",
                    executablePath: await resolveExecutablePath(ctl, env, "libreHardwareMonitorPath", "LibreHardwareMonitor.exe"),
                    hardware: nonEmptyArray(asArray(libreHardwareMonitorSnapshot)),
                }) : undefined,
                physicalDisks: nonEmptyArray(normalizedPhysicalDisks),
                cpuUsage: cpuUsage ?? undefined,
                systemLoad: systemLoad || undefined,
            }) : undefined;
            const connectivity = includeDetailed ? mergeDefined({
                networkAdapters: nonEmptyArray(normalizedNetworkAdapters),
                networkUsage: nonEmptyArray(normalizedNetworkUsage),
                bluetooth: bluetooth || undefined,
                publicIp: publicIp || undefined,
            }) : undefined;
            const payload = mergeDefined({
                ...baseInfo,
                detailLevel,
                cpuPackages: includeDetailed ? nonEmptyArray(enrichedCpuPackages) : undefined,
                loadAverage: os.loadavg(),
                networkInterfaces: includeDetailed ? nonEmptyObject(networkInterfaces) : undefined,
                disks: includeDetailed ? nonEmptyArray(normalizedDisks) : undefined,
                runtimes: includeDetailed ? {
                    nodeExecutable: await getNodeExecutablePath(ctl),
                    denoExecutable: await ctx.getDenoExecutablePath(ctl),
                    ffmpegPath: await resolveExecutablePath(ctl, env, "ffmpegPath", "ffmpeg"),
                    ffprobePath: await resolveExecutablePath(ctl, env, "ffprobePath", "ffprobe"),
                    ytDlpPath: await resolveExecutablePath(ctl, env, "ytDlpPath", "yt-dlp"),
                    libreHardwareMonitorPath: await resolveExecutablePath(ctl, env, "libreHardwareMonitorPath", "LibreHardwareMonitor.exe"),
                    imageMagickPath: await resolveExecutablePath(ctl, env, "imageMagickPath", "magick"),
                    mkvmergePath: await resolveExecutablePath(ctl, env, "mkvmergePath", "mkvmerge"),
                    mkvpropeditPath: await resolveExecutablePath(ctl, env, "mkvpropeditPath", "mkvpropedit"),
                    mkvextractPath: await resolveExecutablePath(ctl, env, "mkvextractPath", "mkvextract"),
                    psqlPath: await resolveExecutablePath(ctl, env, "psqlPath", "psql"),
                    mysqlPath: await resolveExecutablePath(ctl, env, "mysqlPath", "mysql"),
                } : undefined,
                hardware: includeDetailed ? nonEmptyObject(hardware) : undefined,
                connectivity: includeDetailed ? nonEmptyObject(connectivity) : undefined,
                userSessions: includeDetailed ? nonEmptyValue(userSessions) : undefined,
                processSummary: includeDetailed ? (processSummary || undefined) : undefined,
            });
            if (help) {
                const helpPattern = help === true ? "" : String(help || "").trim();
                const validFields = [...new Set([
                        ...Object.keys(systemInfoAliasResolvers),
                        ...collectFieldDescriptors(payload),
                    ])]
                    .filter((entry) => matchDescriptorPattern(entry, helpPattern))
                    .sort((left, right) => left.localeCompare(right));
                return json({
                    success: true,
                    help: help === true ? true : helpPattern,
                    count: validFields.length,
                    validFields,
                    usage: "Call as_system_info again with fields=\"name1,name2\" or field_list=[\"name1\",\"name2\"] to fetch concrete values.",
                });
            }
            if (requestedFields.length > 0) {
                return json({
                    success: true,
                    detailLevel,
                    requestedFields,
                    fields: selectSystemInfoFields(payload, requestedFields),
                });
            }
            return json(payload);
        }),
    }));
}
//# sourceMappingURL=systemInfo.js.map