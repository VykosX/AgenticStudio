import type { ToolsProviderController } from "@lmstudio/sdk";
import type { ToolModuleContext } from "../shared/toolModule";
export type ToolAliasDefinition = {
    name: string;
    controller: string;
    action?: string;
    description: string;
    generalCall: Record<string, unknown>;
};
export declare const TOOL_ALIAS_DEFINITIONS: ToolAliasDefinition[];
export declare const SUPERSEDED_TOOL_NAMES: Set<string>;
export declare function aliasesEnabled(ctl: ToolsProviderController): boolean;
export declare function findToolAliasDefinition(name: string): ToolAliasDefinition | null;
export declare function isToolAliasName(name: string): boolean;
export declare function finalizeConsolidatedToolSurface(tools: any[], ctl: ToolsProviderController): any[];
export declare function registerConsolidatedTools(ctx: ToolModuleContext, tools: any[]): void;
//# sourceMappingURL=consolidated.d.ts.map