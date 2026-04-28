import type { ToolModuleContext } from "../shared/toolModule";
type MathFunctionDoc = {
    name: string;
    summary: string;
    example?: string;
};
type MathConstantDoc = {
    name: string;
    valueExpression: string;
    summary: string;
    aliases?: string[];
};
export declare const mathFunctionDocs: MathFunctionDoc[];
export declare const mathConstantDocs: MathConstantDoc[];
export declare function getMathToolReference(includeDetailedValues?: boolean): Record<string, unknown>;
export declare function getUnitConversionToolReference(includeDetailedValues?: boolean): Record<string, unknown>;
export declare function registerMathAndUnitTools(ctx: ToolModuleContext, tools: any[]): void;
export {};
//# sourceMappingURL=mathAndUnits.d.ts.map