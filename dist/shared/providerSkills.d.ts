export type SkillRecord = {
    id: string;
    name: string;
    category: string | null;
    source: "builtin" | "custom";
    path: string;
    summary: string | null;
    description: string | null;
    promptPath: string | null;
};
export type SkillQueryOptions = {
    includePerAppAutomationSkills?: boolean;
};
export declare function builtInSkillsDirectory(): string;
export declare function customSkillsDirectory(): string;
export declare function listBuiltInSkills(options?: SkillQueryOptions): Promise<SkillRecord[]>;
export declare function listCustomSkills(): Promise<SkillRecord[]>;
export declare function listAllSkills(options?: SkillQueryOptions): Promise<SkillRecord[]>;
export declare function resolveSkillRecord(name: string, options?: SkillQueryOptions): Promise<SkillRecord | null>;
export declare function readSkillContent(record: SkillRecord): Promise<string>;
export declare function readBuiltInSkillPrompts(ids: string[], options?: SkillQueryOptions): Promise<string[]>;
//# sourceMappingURL=providerSkills.d.ts.map