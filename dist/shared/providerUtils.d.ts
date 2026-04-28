import { z } from "zod";
export declare const dynamicToolNameSchema: z.ZodString;
export declare function normalize(input: string): string;
export declare function expandEnvironmentPath(input: string): string;
export declare function levenshteinDistance(a: string, b: string): number;
export declare function computeFuzzyScore(query: string, candidate: string): number;
export declare function truncateOutput(text: string, maxBytes: number): string;
export declare function json(value: unknown): string;
export declare function cavemanifyToolResult(value: unknown, key?: string): unknown;
export declare function escapeForPython(value: string): string;
export declare function indentPython(code: string): string;
export declare function quote(value: string): string;
export declare function asArray<T>(value: unknown): T[];
export declare function toNumberOrNull(value: unknown): number | null;
export declare function splitCommandList(value: string | undefined): string[];
export declare function mergeDefined<T extends Record<string, unknown>>(...objects: T[]): T;
export declare function parseJsonArrayOfStrings(value: string, fieldName: string): string[];
export declare function parseJsonObject(value: string, fieldName: string): Record<string, unknown>;
//# sourceMappingURL=providerUtils.d.ts.map