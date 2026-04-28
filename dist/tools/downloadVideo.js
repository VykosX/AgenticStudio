"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDownloadVideoTool = registerDownloadVideoTool;
function registerDownloadVideoTool(ctx, tools) {
    const { tool, z, safeTool, requireCommandExecution, resolveExecutablePath, getDenoExecutablePath, resolveInsideWorkspace, workspaceRoot, fsp, quote, executeManagedCommand, ctl, env, shell, maxOutputBytes, buildCommandResponse, buildCommandResponsePayload, path, } = ctx;
    const assertNoShellControlOperators = (value, fieldName) => {
        if (/[\r\n;&|`]/.test(String(value || ""))) {
            throw new Error(`${fieldName} contains shell control operators. Pass plain yt-dlp arguments only.`);
        }
    };
    const normalizeDetail = (value) => {
        const normalized = String(value || "compact").trim().toLowerCase();
        if (normalized === "maximum")
            return "max";
        return normalized === "full" || normalized === "max" ? normalized : "compact";
    };
    const collectRecentFiles = async (directory, startedAtMs) => {
        const entries = await fsp.readdir(directory, { withFileTypes: true }).catch(() => []);
        const files = [];
        for (const entry of entries) {
            if (!entry.isFile())
                continue;
            const fullPath = path.join(directory, entry.name);
            const stat = await fsp.stat(fullPath).catch(() => null);
            if (!stat)
                continue;
            if (stat.mtimeMs + 2000 >= startedAtMs) {
                files.push(entry.name);
            }
        }
        return files.sort((left, right) => left.localeCompare(right));
    };
    tools.push(tool({
        name: "as_download_video",
        description: "Download a video or playlist with yt-dlp, including subtitles, metadata, and format controls.",
        parameters: {
            url: z.string(),
            output_directory: z.string().default("."),
            output_template: z.string().default("%(title)s [%(id)s].%(ext)s"),
            mode: z.enum(["video", "audio", "video_and_audio"]).default("video"),
            playlist_mode: z.enum(["auto", "single", "playlist"]).default("auto"),
            quality: z.enum(["best", "1080p", "720p", "480p", "worst", "custom"]).default("best"),
            format_selector: z.string().default(""),
            video_codec_preference: z.enum(["any", "av1", "vp9", "h264"]).default("any"),
            audio_language: z.string().default(""),
            subtitle_mode: z.enum(["none", "manual", "auto", "all"]).default("none"),
            subtitle_languages: z.string().default(""),
            write_thumbnail: z.boolean().default(false),
            write_description: z.boolean().default(false),
            write_info_json: z.boolean().default(false),
            write_comments: z.boolean().default(false),
            embed_metadata: z.boolean().default(false),
            embed_thumbnail: z.boolean().default(false),
            embed_subtitles: z.boolean().default(false),
            extract_audio_format: z.enum(["best", "mp3", "m4a", "flac", "wav", "opus"]).default("best"),
            merge_output_format: z.enum(["auto", "mp4", "mkv", "webm"]).default("auto"),
            filename_restrict: z.boolean().default(false),
            date_after: z.string().default(""),
            extra_args: z.string().default(""),
            detail: z.enum(["compact", "full", "max", "maximum"]).default("compact"),
            timeout_ms: z.number().int().min(1000).max(3600000).default(900000),
        },
        implementation: safeTool("as_download_video", async ({ url, output_directory, output_template, mode, playlist_mode, quality, format_selector, video_codec_preference, audio_language, subtitle_mode, subtitle_languages, write_thumbnail, write_description, write_info_json, write_comments, embed_metadata, embed_thumbnail, embed_subtitles, extract_audio_format, merge_output_format, filename_restrict, date_after, extra_args, detail, timeout_ms, }) => {
            requireCommandExecution();
            const detailLevel = normalizeDetail(detail);
            const ytDlp = await resolveExecutablePath(ctl, env, "ytDlpPath", "yt-dlp");
            const denoExecutable = await getDenoExecutablePath(ctl);
            const destinationDirectory = resolveInsideWorkspace(workspaceRoot, output_directory);
            await fsp.mkdir(destinationDirectory, { recursive: true });
            const startedAtMs = Date.now();
            const parts = [quote(ytDlp), "--newline", `-P ${quote(destinationDirectory)}`, `-o ${quote(output_template)}`];
            if (denoExecutable) {
                parts.push(`--js-runtimes ${quote(`deno:${denoExecutable}`)}`);
            }
            if (playlist_mode === "single")
                parts.push("--no-playlist");
            if (playlist_mode === "playlist")
                parts.push("--yes-playlist");
            if (mode === "audio") {
                parts.push("-x");
                if (extract_audio_format !== "best") {
                    parts.push(`--audio-format ${quote(extract_audio_format)}`);
                }
            }
            const formatSelector = (() => {
                if (String(format_selector || "").trim())
                    return String(format_selector).trim();
                const codecMap = { av1: "av01", vp9: "vp9", h264: "avc1" };
                const codecToken = codecMap[String(video_codec_preference)] || "";
                const codecFilter = codecToken ? `[vcodec*=${codecToken}]` : "";
                if (mode === "audio")
                    return "bestaudio/best";
                if (quality === "1080p")
                    return `bestvideo[height<=1080]${codecFilter}+bestaudio/best[height<=1080]`;
                if (quality === "720p")
                    return `bestvideo[height<=720]${codecFilter}+bestaudio/best[height<=720]`;
                if (quality === "480p")
                    return `bestvideo[height<=480]${codecFilter}+bestaudio/best[height<=480]`;
                if (quality === "worst")
                    return mode === "video_and_audio" ? "worstvideo+worstaudio/worst" : `worst${codecFilter}`;
                return `bestvideo${codecFilter}+bestaudio/best`;
            })();
            if (formatSelector)
                parts.push(`-f ${quote(formatSelector)}`);
            if (subtitle_mode === "manual" || subtitle_mode === "all")
                parts.push("--write-subs");
            if (subtitle_mode === "auto" || subtitle_mode === "all")
                parts.push("--write-auto-subs");
            if (subtitle_mode !== "none" && String(subtitle_languages || "").trim()) {
                parts.push(`--sub-langs ${quote(String(subtitle_languages))}`);
            }
            else if (subtitle_mode === "all") {
                parts.push(`--sub-langs ${quote("all")}`);
            }
            if (embed_subtitles)
                parts.push("--embed-subs");
            if (String(audio_language || "").trim()) {
                parts.push(`--extractor-args ${quote(`youtube:lang=${String(audio_language).trim()}`)}`);
            }
            if (write_thumbnail)
                parts.push("--write-thumbnail");
            if (write_description)
                parts.push("--write-description");
            if (write_info_json)
                parts.push("--write-info-json");
            if (write_comments)
                parts.push("--write-comments");
            if (embed_metadata)
                parts.push("--embed-metadata");
            if (embed_thumbnail)
                parts.push("--embed-thumbnail");
            if (filename_restrict)
                parts.push("--restrict-filenames");
            if (String(date_after || "").trim())
                parts.push(`--dateafter ${quote(String(date_after).trim())}`);
            if (merge_output_format !== "auto" && mode !== "audio")
                parts.push(`--merge-output-format ${quote(String(merge_output_format))}`);
            if (String(extra_args || "").trim()) {
                assertNoShellControlOperators(extra_args, "extra_args");
                parts.push(String(extra_args).trim());
            }
            parts.push(quote(url));
            const command = parts.join(" ");
            const result = await executeManagedCommand(ctl, command, { cwd: destinationDirectory, shell, env }, timeout_ms, Math.max(maxOutputBytes, 500000));
            const commandPayload = buildCommandResponsePayload(command, result);
            const recentFiles = await collectRecentFiles(destinationDirectory, startedAtMs);
            if (detailLevel === "max") {
                return buildCommandResponse(command, result);
            }
            return JSON.stringify({
                success: commandPayload.success,
                exitCode: commandPayload.exitCode,
                detail: detailLevel,
                outputDirectory: path.relative(workspaceRoot, destinationDirectory) || ".",
                downloadedCount: recentFiles.length,
                downloadedFiles: recentFiles,
                stdoutPath: commandPayload.stdoutPath,
                stderrPath: commandPayload.stderrPath,
                stdoutPreview: detailLevel === "full" ? commandPayload.stdout : undefined,
                stderrPreview: detailLevel === "full" ? commandPayload.stderr : undefined,
                stdoutTruncated: commandPayload.stdoutTruncated,
                stderrTruncated: commandPayload.stderrTruncated,
                error: commandPayload.error,
            });
        }),
    }));
}
//# sourceMappingURL=downloadVideo.js.map