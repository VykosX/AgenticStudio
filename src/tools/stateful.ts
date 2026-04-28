// @ts-nocheck
import type { ToolModuleContext } from "../shared/toolModule";
import { listAllSkills, readSkillContent, resolveSkillRecord } from "../shared/providerSkills";

export function registerStatefulTools(ctx: ToolModuleContext, tools: any[]): void {
  const { tool, z, safeTool, workspaceRoot, pluginDataDirectory, resolveInsideDirectory, readJsonFile, writeJsonFile, readMergedRecords, resolveMemoryPaths, resolveTodoPaths, fileExists, skillsDirectory, dynamicToolNameSchema, mergeDefined, path, fsp, json, normalize, ctl, configSchematics } = ctx as any;

  const agentTaskStatuses = ["open", "in_progress", "blocked", "done", "cancelled"] as const;
  const agentTaskPriorities = ["low", "normal", "high", "critical"] as const;
  const scopeLabel = (global: boolean, context: { mode: string }) => global ? "global" : context.mode;
  const currentSkillQueryOptions = () => ({
    includePerAppAutomationSkills: ((ctl.getPluginConfig(configSchematics).get("enablePerAppAutomationGuidance") as boolean | undefined) ?? true) === true,
  });

  // Task state is stored per workspace so separate projects do not share queues.
  const workspaceStateDirectory = async () => {
    const crypto = await import("crypto");
    const workspaceKey = crypto.createHash("sha256").update(path.resolve(workspaceRoot)).digest("hex").slice(0, 16);
    return path.join(pluginDataDirectory(), "workspaces", workspaceKey);
  };

  const agentTasksPath = async () => path.join(await workspaceStateDirectory(), "agent-tasks.json");

  const readAgentTasks = async () => readJsonFile<Array<Record<string, unknown>>>(await agentTasksPath(), []);

  const writeAgentTasks = async (items: Array<Record<string, unknown>>) => {
    await writeJsonFile(await agentTasksPath(), items);
  };

tools.push(tool({
    name: "as_memory_list",
    description: "List saved memory entries, optionally filtering by query or tag.",
    parameters: {
      query: z.string().default(""),
      tag: z.string().default(""),
      global: z.boolean().default(false),
      limit: z.number().int().min(1).max(500).default(100),
    },
    implementation: safeTool("as_memory_list", async ({ query, tag, global, limit }) => {
      const { readPaths, context } = await resolveMemoryPaths(workspaceRoot, Boolean(global));
      let entries = await readMergedRecords(readPaths, "id");
      if ((query as string).trim()) {
        const wanted = normalize(query as string);
        entries = entries.filter((entry) => normalize(`${entry.title || ""} ${entry.content || ""}`).includes(wanted));
      }
      if ((tag as string).trim()) {
        const wanted = normalize(tag as string);
        entries = entries.filter((entry) => Array.isArray(entry.tags) && (entry.tags as unknown[]).some((item) => normalize(String(item)) === wanted));
      }
      return json({ scope: scopeLabel(Boolean(global), context), count: entries.length, entries: entries.slice(0, limit as number) });
    }),
  }));

tools.push(tool({
    name: "as_memory_upsert",
    description: "Create or update one structured memory entry.",
    parameters: {
      id: z.string().default(""),
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string()).default([]),
      global: z.boolean().default(false),
    },
    implementation: safeTool("as_memory_upsert", async ({ id, title, content, tags, global }) => {
      const crypto = await import("crypto");
      const { writePaths, context } = await resolveMemoryPaths(workspaceRoot, Boolean(global));
      const entryId = String(id || "").trim() || crypto.randomUUID();
      const nextEntry = {
        id: entryId,
        title,
        content,
        tags,
        updatedAt: new Date().toISOString(),
      };
      for (const filePath of writePaths) {
        const entries = await readJsonFile<Array<Record<string, unknown>>>(filePath, []);
        const index = entries.findIndex((entry) => String(entry.id) === entryId);
        if (index >= 0) {
          entries[index] = { ...entries[index], ...nextEntry };
        } else {
          entries.push({ ...nextEntry, createdAt: nextEntry.updatedAt });
        }
        await writeJsonFile(filePath, entries);
      }
      return json({ success: true, scope: scopeLabel(Boolean(global), context), entry: nextEntry });
    }),
  }));

tools.push(tool({
    name: "as_memory_delete",
    description: "Delete one memory entry by id.",
    parameters: {
      id: z.string(),
      global: z.boolean().default(false),
    },
    implementation: safeTool("as_memory_delete", async ({ id, global }) => {
      const { writePaths, context } = await resolveMemoryPaths(workspaceRoot, Boolean(global));
      let remaining = 0;
      for (const filePath of writePaths) {
        const entries = await readJsonFile<Array<Record<string, unknown>>>(filePath, []);
        const nextEntries = entries.filter((entry) => String(entry.id) !== String(id));
        remaining = nextEntries.length;
        await writeJsonFile(filePath, nextEntries);
      }
      return json({ success: true, scope: scopeLabel(Boolean(global), context), deletedId: id, remaining });
    }),
  }));

tools.push(tool({
    name: "as_todo_list",
    description: "List todo items, optionally filtering by status.",
    parameters: {
      status: z.enum(["open", "in_progress", "done", "all"]).default("all"),
      global: z.boolean().default(false),
    },
    implementation: safeTool("as_todo_list", async ({ status, global }) => {
      const { readPaths, context } = await resolveTodoPaths(workspaceRoot, Boolean(global));
      let items = await readMergedRecords(readPaths, "id");
      if (status !== "all") items = items.filter((item) => item.status === status);
      return json({ scope: scopeLabel(Boolean(global), context), count: items.length, items });
    }),
  }));

tools.push(tool({
    name: "as_todo_upsert",
    description: "Create a todo or update an existing todo by id.",
    parameters: {
      id: z.string().default(""),
      text: z.string(),
      priority: z.enum(["low", "normal", "high"]).default("normal"),
      notes: z.string().default(""),
      status: z.enum(["open", "in_progress", "done"]).default("open"),
      global: z.boolean().default(false),
    },
    implementation: safeTool("as_todo_upsert", async ({ id, text, priority, notes, status, global }) => {
      const crypto = await import("crypto");
      const { writePaths, context } = await resolveTodoPaths(workspaceRoot, Boolean(global));
      const now = new Date().toISOString();
      const todoId = String(id || "").trim() || crypto.randomUUID();
      let nextItem: Record<string, unknown> | null = null;
      for (const filePath of writePaths) {
        const items = await readJsonFile<Array<Record<string, unknown>>>(filePath, []);
        const index = items.findIndex((item) => String(item.id) === todoId);
        const current = index >= 0 ? items[index] : null;
        const item = {
          id: todoId,
          text,
          priority,
          notes,
          status,
          createdAt: current?.createdAt || now,
          updatedAt: now,
        };
        if (index >= 0) {
          items[index] = item;
        } else {
          items.push(item);
        }
        nextItem = item;
        await writeJsonFile(filePath, items);
      }
      return json({ success: true, scope: scopeLabel(Boolean(global), context), item: nextItem });
    }),
  }));

tools.push(tool({
    name: "as_todo_delete",
    description: "Delete one todo item by id.",
    parameters: {
      id: z.string(),
      global: z.boolean().default(false),
    },
    implementation: safeTool("as_todo_delete", async ({ id, global }) => {
      const { writePaths, context } = await resolveTodoPaths(workspaceRoot, Boolean(global));
      let remaining = 0;
      for (const filePath of writePaths) {
        const items = await readJsonFile<Array<Record<string, unknown>>>(filePath, []);
        const nextItems = items.filter((item) => String(item.id) !== String(id));
        remaining = nextItems.length;
        await writeJsonFile(filePath, nextItems);
      }
      return json({ success: true, scope: scopeLabel(Boolean(global), context), deletedId: id, remaining });
    }),
  }));

tools.push(tool({
    name: "as_agent_task",
    description: "Manage persistent agent task records with one action-based controller. Use as_tool_help for examples when unsure.",
    parameters: {
      action: z.enum(["create", "get", "list", "next", "update", "append_output", "delete"]),
      id: z.string().default(""),
      title: z.string().default(""),
      description: z.string().default(""),
      status: z.enum([...agentTaskStatuses, "all"]).default("open"),
      priority: z.enum(agentTaskPriorities).default("normal"),
      assignee: z.string().default(""),
      tags: z.array(z.string()).default([]),
      notes: z.string().default(""),
      due_at: z.string().default(""),
      parent_id: z.string().default(""),
      query: z.string().default(""),
      limit: z.number().int().min(1).max(1000).default(200),
      patch_json: z.string().default("{}"),
      text: z.string().default(""),
    },
    implementation: safeTool("as_agent_task", async ({ action, id, title, description, status, priority, assignee, tags, notes, due_at, parent_id, query, limit, patch_json, text }) => {
      const selectedAction = String(action);
      if (selectedAction === "create") {
        if (!String(title || "").trim()) throw new Error("title is required for action=create.");
        const crypto = await import("crypto");
        const items = await readAgentTasks();
        const now = new Date().toISOString();
        const taskId = String(id || "").trim() || crypto.randomUUID();
        const index = items.findIndex((item) => String(item.id) === taskId);
        const current = index >= 0 ? items[index] : null;
        const nextTask = {
          id: taskId,
          title,
          description,
          status: status === "all" ? "open" : status,
          priority,
          assignee: String(assignee || "").trim() || null,
          tags,
          notes,
          dueAt: String(due_at || "").trim() || null,
          parentId: String(parent_id || "").trim() || null,
          createdAt: current?.createdAt || now,
          updatedAt: now,
          output: current?.output || "",
        };
        if (index >= 0) items[index] = nextTask;
        else items.push(nextTask);
        await writeAgentTasks(items);
        return json({ success: true, task: nextTask });
      }
      if (selectedAction === "get") {
        const items = await readAgentTasks();
        const task = items.find((item) => String(item.id) === String(id)) || null;
        if (!task) throw new Error(`Task '${id as string}' was not found.`);
        return json({ task });
      }
      if (selectedAction === "list") {
        let items = await readAgentTasks();
        if (status !== "all") items = items.filter((item) => item.status === status);
        if (String(assignee || "").trim()) {
          const wanted = normalize(assignee as string);
          items = items.filter((item) => normalize(String(item.assignee || "")) === wanted);
        }
        if (String(query || "").trim()) {
          const wanted = normalize(query as string);
          items = items.filter((item) => normalize(`${item.title || ""} ${item.description || ""} ${item.notes || ""}`).includes(wanted));
        }
        items.sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
        return json({ count: items.length, tasks: items.slice(0, limit as number) });
      }
      if (selectedAction === "next") {
        const priorityWeight: Record<string, number> = { critical: 4, high: 3, normal: 2, low: 1 };
        const tasks = (await readAgentTasks()).filter((item) => !["done", "cancelled"].includes(String(item.status || "")));
        tasks.sort((left, right) =>
          (priorityWeight[String(right.priority || "normal")] || 0) - (priorityWeight[String(left.priority || "normal")] || 0)
          || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
        );
        return json({ task: tasks[0] || null });
      }
      if (selectedAction === "update") {
        const patch = JSON.parse(patch_json as string);
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("patch_json must be a JSON object.");
        const items = await readAgentTasks();
        const index = items.findIndex((item) => String(item.id) === String(id));
        if (index < 0) throw new Error(`Task '${id as string}' was not found.`);
        const nextTask = { ...items[index], ...patch, id: String(id), updatedAt: new Date().toISOString() };
        items[index] = nextTask;
        await writeAgentTasks(items);
        return json({ success: true, task: nextTask });
      }
      if (selectedAction === "append_output") {
        const items = await readAgentTasks();
        const index = items.findIndex((item) => String(item.id) === String(id));
        if (index < 0) throw new Error(`Task '${id as string}' was not found.`);
        const stamp = new Date().toISOString();
        const previous = String(items[index].output || "");
        items[index] = { ...items[index], output: `${previous}${previous ? "\n" : ""}[${stamp}] ${String(text)}`, updatedAt: stamp };
        await writeAgentTasks(items);
        return json({ success: true, task: items[index] });
      }
      if (selectedAction === "delete") {
        const items = await readAgentTasks();
        const nextItems = items.filter((item) => String(item.id) !== String(id));
        await writeAgentTasks(nextItems);
        return json({ success: true, deletedId: id, remaining: nextItems.length });
      }
      throw new Error(`Unsupported agent task action: ${selectedAction}`);
    }),
  }));

tools.push(tool({
    name: "as_skill_recommend",
    description: "Recommend built-in or custom skills for a specific task while keeping full skill content out of context. For multi-step desktop automation, multimodal inspection, recurring workflows, or any task that appears to match an existing skill, use this before acting.",
    parameters: {
      query: z.string(),
      category: z.string().default(""),
      limit: z.number().int().min(1).max(25).default(8),
      include_builtin: z.boolean().default(true),
      include_custom: z.boolean().default(true),
    },
    implementation: safeTool("as_skill_recommend", async ({ query, category, limit, include_builtin, include_custom }) => {
      const wanted = normalize(query as string);
      const categoryWanted = normalize(category as string);
      const words = wanted.split(/\s+/).filter(Boolean);
      const hasAny = (...terms: string[]) => terms.some((term) => wanted.includes(normalize(term)));
      const perAppAutomationGuidanceEnabled = currentSkillQueryOptions().includePerAppAutomationSkills === true;
      const desktopIntent = hasAny("desktop", "window", "windows", "mouse", "keyboard", "clipboard", "click", "drag", "drop", "type", "typed", "screenshot", "screen", "ui", "button", "menu", "app", "application", "calculator", "pointer", "cursor", "hamburger", "afterburner", "fan speed", "slider");
      const visionIntent = hasAny("vision", "ocr", "recognize", "recognition", "read text", "transcribe", "image", "images", "pixels", "pixel", "screenshot", "screen");
      const formIntent = hasAny("form", "forms", "field", "fields", "submit", "submission", "record", "records", "data entry", "admin panel", "fill", "filling", "paste rows");
      const loopIntent = hasAny("loop", "resume", "resumption", "checkpoint", "recover", "recovery", "durable", "long running", "batch", "queue", "task registry", "ownership", "restart", "restarts", "compaction");
      const automationIntent = hasAny("automation", "automate", "workflow", "agent");
      const browserIntent = hasAny("browser", "web", "website", "websites", "webpage", "webpages", "web page", "web pages", "tab", "tabs", "page", "pages", "link", "links", "navigate", "navigation", "browse", "browsing", "search result", "search results", "address bar", "browser script", "headless browser");
      const autonomousBrowserIntent = browserIntent && hasAny("autonomous", "autonomously", "autonomy", "agentic", "browser agent", "browser automation", "headless", "follow links", "click through", "navigate webpage", "navigate website", "browse website", "browse webpage", "work through a site", "explore a site", "research a website");
      const specificLocalBrowserIntent = hasAny("chrome", "google chrome", "edge", "microsoft edge", "firefox", "brave", "safari", "opera", "vivaldi", "arc", "arc browser", "local browser", "installed browser", "browser window", "on my machine", "on my computer", "on my desktop");
      const singleAppIntent = desktopIntent && !formIntent && hasAny("app", "application", "window", "calculator", "afterburner", "msi afterburner", "notepad", "paint", "settings", "browser", "chrome", "edge", "firefox", "word", "excel", "powerpoint", "menu", "dialog", "button", "foreground", "slider", "fan speed");
      const supportedPerAppIntent = hasAny("calculator", "msi afterburner", "afterburner", "fan speed");
      const skills = (await listAllSkills(currentSkillQueryOptions()))
        .filter((skill) => include_builtin || skill.source !== "builtin")
        .filter((skill) => include_custom || skill.source !== "custom")
        .filter((skill) => !categoryWanted || normalize(String(skill.category || "")).includes(categoryWanted));
      const scored = skills.map((skill) => {
        const haystack = normalize(`${skill.id} ${skill.name} ${skill.category || ""} ${skill.description || ""} ${skill.summary || ""}`);
        const normalizedId = normalize(skill.id);
        let score = 0;
        const reasons: string[] = [];
        if (haystack.includes(wanted)) score += 8;
        for (const word of words) {
          if (haystack.includes(word)) score += 2;
          if (normalizedId.includes(word)) score += 1;
        }
        if (categoryWanted && normalize(String(skill.category || "")) === categoryWanted) score += 3;
        if (normalizedId === "desktop/per-app-automation-guidance") {
          if (perAppAutomationGuidanceEnabled && desktopIntent) { score += 12; reasons.push("single-app desktop workflow"); }
          if (singleAppIntent) { score += 14; reasons.push("app-focused interaction guidance"); }
          if (supportedPerAppIntent) { score += 6; reasons.push("supported app notes"); }
          if (hasAny("msi afterburner", "afterburner", "fan speed", "slider")) { score += 8; reasons.push("custom-control app notes"); }
          if (visionIntent) score += 3;
          if (specificLocalBrowserIntent) score -= 18;
          if (loopIntent) score -= 3;
          if (formIntent) score -= 4;
        } else if (normalizedId === "desktop/vision-guided-computer-use") {
          if (desktopIntent) { score += 10; reasons.push("specific desktop interaction workflow"); }
          if (visionIntent) { score += 8; reasons.push("vision-first screenshot verification"); }
          if (hasAny("calculator", "menu", "button", "window", "click", "drag", "cursor", "afterburner", "slider", "fan speed")) score += 6;
          if (specificLocalBrowserIntent) { score += 14; reasons.push("installed browser window automation"); }
          if (autonomousBrowserIntent && !specificLocalBrowserIntent) score -= 10;
          if (perAppAutomationGuidanceEnabled && singleAppIntent) score -= 6;
          if (formIntent) score -= 2;
        } else if (normalizedId === "web/autonomous-browser-navigation") {
          if (browserIntent) { score += 12; reasons.push("browser-driven webpage workflow"); }
          if (autonomousBrowserIntent) { score += 18; reasons.push("autonomous browser navigation"); }
          if (hasAny("site search", "search page", "follow links", "link graph", "quora", "twitter", "x", "youtube", "reddit", "github", "browser script", "headless browser")) score += 8;
          if (specificLocalBrowserIntent) score -= 16;
          if (desktopIntent && !browserIntent) score -= 6;
          if (formIntent) score -= 2;
        } else if (normalizedId === "desktop/form-filling-automation") {
          if (formIntent) { score += 16; reasons.push("form/data-entry workflow"); }
          if (hasAny("csv", "record", "records", "field", "fields", "submit")) score += 8;
          if (hasAny("calculator", "menu", "hamburger")) score -= 8;
        } else if (normalizedId === "automation/safe-desktop-agent-loop") {
          if (desktopIntent && loopIntent) { score += 14; reasons.push("recoverable desktop observe-act loop"); }
          else if (desktopIntent && automationIntent) score += 4;
          if (!desktopIntent) score -= 2;
        } else if (normalizedId === "desktop/computer-use-operator") {
          if (desktopIntent) { score += 7; reasons.push("direct local app operation"); }
          if (visionIntent) score -= 2;
          if (loopIntent) score -= 3;
        } else if (normalizedId === "media/vision-inspection-workflow") {
          if (visionIntent) { score += 10; reasons.push("image/screenshot inspection"); }
          if (!desktopIntent) score += 4;
          if (desktopIntent && hasAny("click", "type", "window", "drag", "button")) score -= 8;
        } else if (normalizedId === "automation/durable-agent-work") {
          if (loopIntent && hasAny("queue", "task registry", "ownership", "parallel", "compaction", "restart")) { score += 12; reasons.push("durable orchestration and recovery"); }
          if (desktopIntent && !loopIntent) score -= 8;
        } else if (normalizedId === "workflow/agent-work-loop") {
          if (loopIntent) { score += 8; reasons.push("generic plan-do-verify loop"); }
          if (desktopIntent) score -= 5;
        }
        return { skill, score, reasons };
      })
        .filter((entry) => entry.score > 0 || !wanted)
        .sort((left, right) => right.score - left.score || left.skill.id.localeCompare(right.skill.id))
        .slice(0, limit as number)
        .map(({ skill, score, reasons }) => mergeDefined({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          source: skill.source,
          description: skill.description || undefined,
          summary: skill.summary || undefined,
          score,
          relevanceHints: Array.from(new Set(reasons)).slice(0, 3),
        }));
      const primaryRecommendationId = scored[0]?.id || undefined;
      const closeRecommendationIds = primaryRecommendationId
        ? scored
          .slice(1)
          .filter((entry) => entry.score >= ((scored[0]?.score || 0) - 2))
          .map((entry) => entry.id)
          .slice(0, 2)
        : [];
      return json(mergeDefined({
        query,
        count: scored.length,
        primaryRecommendationId,
        recommendedReadCall: primaryRecommendationId
          ? { action: "read", name: primaryRecommendationId }
          : undefined,
        alsoConsiderSkillIds: closeRecommendationIds.length > 0 ? closeRecommendationIds : undefined,
        recommendations: scored,
        instruction: scored.length > 0
          ? closeRecommendationIds.length > 0
            ? `Read this exact skill next with as_skill(action="read", name="${primaryRecommendationId}") before acting unless the user asked for raw tool use. If the task clearly spans overlapping workflows, also consider ${closeRecommendationIds.join(", ")}.`
            : `Read this exact skill next with as_skill(action="read", name="${primaryRecommendationId}") before acting unless the user asked for raw tool use.`
          : "No matching skill was found, so proceeding without a skill is acceptable.",
        customSkillGuidance: scored.length === 0
          ? "No default skill matched. For recurring work, scaffold a custom skill."
          : "If none fit a recurring workflow well, scaffold a custom skill.",
      }));
    }),
  }));

tools.push(tool({
    name: "as_skill",
    description: "Manage agentic-studio skills with one action-based controller. Use as_skill_recommend for discovery first.",
    parameters: {
      action: z.enum(["list", "read", "create", "scaffold", "validate", "delete"]),
      name: z.string().default(""),
      content: z.string().default(""),
      summary: z.string().default(""),
      overwrite: z.boolean().default(true),
      query: z.string().default(""),
      category: z.string().default(""),
      limit: z.number().int().min(1).max(500).default(100),
    },
    implementation: safeTool("as_skill", async ({ action, name, content, summary, overwrite, query, category, limit }) => {
      const selectedAction = String(action);
      if (selectedAction === "list") {
        let skills = await listAllSkills(currentSkillQueryOptions());
        if (String(category || "").trim()) {
          const wanted = normalize(category as string);
          skills = skills.filter((skill) => normalize(String(skill.category || "")).includes(wanted));
        }
        if (String(query || "").trim()) {
          const wanted = normalize(query as string);
          skills = skills.filter((skill) => normalize(`${skill.id} ${skill.name} ${skill.description || ""} ${skill.summary || ""}`).includes(wanted));
        }
        return json({ count: skills.length, skills: skills.slice(0, limit as number) });
      }
      if (selectedAction === "read") {
        const skill = await resolveSkillRecord(name as string, currentSkillQueryOptions());
        if (!skill) throw new Error(`Skill '${name as string}' was not found.`);
        const skillContent = await readSkillContent(skill);
        return json({
          name: skill.id,
          source: skill.source,
          category: skill.category,
          path: skill.path,
          content: skillContent,
          instruction: `Before continuing, briefly tell the user that you are using the skill '${skill.id}'.`,
          modelReminder: `Announce skill usage explicitly to the user and include the exact skill name '${skill.id}' before following its workflow.`,
        });
      }
      if (selectedAction === "create") {
        const safeName = dynamicToolNameSchema.parse(name);
        const fullPath = resolveInsideDirectory(skillsDirectory(workspaceRoot), `${safeName}.md`);
        if (!overwrite && await fileExists(fullPath)) throw new Error(`Skill already exists: ${safeName}`);
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, String(content), "utf8");
        return json({ success: true, name: safeName, source: "custom", path: fullPath });
      }
      if (selectedAction === "scaffold") {
        const safeName = dynamicToolNameSchema.parse(name);
        const fullPath = resolveInsideDirectory(skillsDirectory(workspaceRoot), `${safeName}.md`);
        if (!overwrite && await fileExists(fullPath)) throw new Error(`Skill already exists: ${safeName}`);
        const scaffold = [
          `# ${safeName}`,
          "",
          String(summary || "").trim() || "One-line summary of what this skill helps with.",
          "",
          "## When To Use",
          "- Describe the user intent or context that should trigger this skill.",
          "",
          "## Inputs",
          "- List the required inputs, assumptions, or local files this skill expects.",
          "",
          "## Steps",
          "1. Gather the minimum context needed.",
          "2. Perform the task using the preferred local workflow.",
          "3. Validate the result before finishing.",
          "",
          "## Outputs",
          "- Describe the expected artifact or result.",
        ].join("\n");
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, scaffold, "utf8");
        return json({ success: true, name: safeName, source: "custom", path: fullPath });
      }
      if (selectedAction === "validate") {
        const skill = await resolveSkillRecord(name as string, currentSkillQueryOptions());
        if (!skill) throw new Error(`Skill '${name as string}' was not found.`);
        const skillContent = await readSkillContent(skill);
        const checks = skill.source === "builtin"
          ? [
            { ok: /^---\s*[\r\n][\s\S]*?[\r\n]---/m.test(skillContent), message: "Built-in skills should include YAML frontmatter." },
            { ok: /^---\s*[\r\n][\s\S]*?\bname:\s*\S+/m.test(skillContent), message: "Built-in skills should declare a frontmatter name." },
            { ok: /^---\s*[\r\n][\s\S]*?\bdescription:\s*\S+/m.test(skillContent), message: "Built-in skills should declare a frontmatter description." },
            { ok: /^##\s+(When To Use|Workflow|Steps)/m.test(skillContent), message: "Built-in skills should explain when to use them and how they work." },
          ]
          : [
            { ok: /^#\s+\S/m.test(skillContent), message: "Skill should start with an H1 title." },
            { ok: /^##\s+When To Use/m.test(skillContent), message: "Add a 'When To Use' section." },
            { ok: /^##\s+Steps/m.test(skillContent), message: "Add a 'Steps' section." },
            { ok: /^##\s+Outputs/m.test(skillContent), message: "Add an 'Outputs' section." },
          ];
        const issues = checks.filter((check) => !check.ok).map((check) => check.message);
        return json({ success: issues.length === 0, name: skill.id, source: skill.source, path: skill.path, issues });
      }
      if (selectedAction === "delete") {
        const fullPath = resolveInsideDirectory(skillsDirectory(workspaceRoot), `${name as string}.md`);
        await fsp.rm(fullPath, { force: true });
        return json({ success: true, name });
      }
      throw new Error(`Unsupported skill action: ${selectedAction}`);
    }),
  }));

tools.push(tool({
    name: "as_sleep",
    description: "Pause tool execution for a bounded number of seconds during automation or orchestration flows.",
    parameters: {
      seconds: z.number().min(0).max(600).default(1),
    },
    implementation: safeTool("as_sleep", async ({ seconds }) => {
      const durationMs = Math.round(Number(seconds) * 1000);
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      return json({ success: true, seconds, sleptMs: durationMs });
    }),
  }));
}
