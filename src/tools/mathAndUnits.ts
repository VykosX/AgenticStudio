// @ts-nocheck
import * as path from "path";
import { all, create } from "mathjs";
import type { ToolModuleContext } from "../shared/toolModule";

const mathEngine = create(all, {
  number: "BigNumber",
  precision: 64,
}) as any;

type MathAngleUnit = "degrees" | "radians";
type MathDefinitionEntry = { key: string; statement: string };
type PersistedMathScope = { lastResultText?: string; definitions?: MathDefinitionEntry[] };
type DateInputType = "auto" | "iso" | "unix_seconds" | "unix_milliseconds" | "excel_serial" | "julian_day";
type DateOutputType = "iso" | "local" | "unix_seconds" | "unix_milliseconds" | "excel_serial" | "julian_day" | "parts";
type DurationParts = {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
};
type UnitCategory =
  | "area"
  | "currency"
  | "digital_storage"
  | "energy"
  | "fuel"
  | "length"
  | "mass"
  | "power"
  | "pressure"
  | "speed"
  | "temperature"
  | "time"
  | "torque"
  | "volume"
  | "cooking";
type LinearUnitDefinition = { canonical: string; factor: number; aliases: string[] };
type MathFunctionDoc = { name: string; summary: string; example?: string };
type MathConstantDoc = { name: string; valueExpression: string; summary: string; aliases?: string[] };

function mathStateFilePathFromDirectory(baseDirectory: string): string {
  return path.join(baseDirectory, "math-scope.json");
}

function normalizeUnitKey(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, " ")
    .trim();
}

function preprocessMathExpression(expression: string): string {
  return String(expression || "")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/π/g, "pi")
    .replace(/τ/g, "tau")
    .replace(/φ/g, "phi")
    .replace(/ℯ/g, "e")
    .replace(/→/g, " to ")
    .replace(/\bin\b/g, " to ")
    .split(/[\n;]+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return trimmed;
      const letAssignment = trimmed.match(/^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (letAssignment) return `${letAssignment[1]} = ${letAssignment[2]}`;
      const walrusAssignment = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+)$/);
      if (walrusAssignment) return `${walrusAssignment[1]} = ${walrusAssignment[2]}`;
      const reversedAssignment = trimmed.match(/^(.+?)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/);
      if (reversedAssignment && !/^[A-Za-z_][A-Za-z0-9_]*(\s*\([^)]*\))?$/.test(reversedAssignment[1].trim())) {
        return `${reversedAssignment[2]} = ${reversedAssignment[1].trim()}`;
      }
      return trimmed;
    })
    .join("; ");
}

function getMathFunctionDefinitions(angleUnit: MathAngleUnit): Record<string, (...args: any[]) => any> {
  const toRadians = (value: any) => angleUnit === "degrees"
    ? mathEngine.multiply(value, mathEngine.divide(mathEngine.pi, 180))
    : value;
  const fromRadians = (value: any) => angleUnit === "degrees"
    ? mathEngine.multiply(value, mathEngine.divide(180, mathEngine.pi))
    : value;
  const numeric = (value: any) => Number(mathEngine.number(value));
  const asBigNumber = (value: number) => mathEngine.bignumber(String(value));
  const flatten = (args: any[]): any[] => args.flatMap((item: any) => Array.isArray(item) ? flatten(item) : [item]);
  const gamma = (value: any) => {
    const numericValue = numeric(value);
    return Number.isInteger(numericValue) ? mathEngine.gamma(value) : mathEngine.gamma(numericValue);
  };
  const factorial = (value: any) => mathEngine.factorial(value);
  const combinations = (n: any, k: any) => mathEngine.combinations(n, k);
  const permutations = (n: any, k: any) => mathEngine.permutations(n, k);
  const binomialPmf = (k: any, n: any, p: any) => {
    const kk = numeric(k);
    const nn = numeric(n);
    const pp = numeric(p);
    if (!Number.isInteger(kk) || !Number.isInteger(nn) || kk < 0 || nn < 0 || kk > nn) return asBigNumber(0);
    return asBigNumber(Number(combinations(nn, kk)) * (pp ** kk) * ((1 - pp) ** (nn - kk)));
  };
  const poissonPmf = (k: any, lambda: any) => {
    const kk = numeric(k);
    const ll = numeric(lambda);
    if (!Number.isInteger(kk) || kk < 0 || ll < 0) return asBigNumber(0);
    return asBigNumber((ll ** kk) * Math.exp(-ll) / Number(factorial(kk)));
  };
  const hyperPmf = (k: any, population: any, successStates: any, draws: any) => {
    const kk = numeric(k);
    const nn = numeric(population);
    const mm = numeric(successStates);
    const dd = numeric(draws);
    if (![kk, nn, mm, dd].every(Number.isFinite)) return asBigNumber(0);
    return asBigNumber((Number(combinations(mm, kk)) * Number(combinations(nn - mm, dd - kk))) / Number(combinations(nn, dd)));
  };
  return {
    abs: (x: any) => mathEngine.abs(x),
    sqrt: (x: any) => mathEngine.sqrt(x),
    cbrt: (x: any) => mathEngine.cbrt(x),
    exp: (x: any) => mathEngine.exp(x),
    ln: (x: any) => mathEngine.log(x),
    log: (x: any) => mathEngine.log10(x),
    lg: (x: any) => mathEngine.log10(x),
    lb: (x: any) => mathEngine.log2(x),
    logn: (base: any, x: any) => mathEngine.divide(mathEngine.log(x), mathEngine.log(base)),
    int: (x: any) => mathEngine.fix(x),
    frac: (x: any) => mathEngine.subtract(x, mathEngine.fix(x)),
    trunc: (x: any) => mathEngine.fix(x),
    round: (x: any, decimals?: any) => decimals === undefined ? mathEngine.round(x) : mathEngine.round(x, decimals),
    ceil: (x: any) => mathEngine.ceil(x),
    floor: (x: any) => mathEngine.floor(x),
    sin: (x: any) => mathEngine.sin(toRadians(x)),
    cos: (x: any) => mathEngine.cos(toRadians(x)),
    tan: (x: any) => mathEngine.tan(toRadians(x)),
    asin: (x: any) => fromRadians(mathEngine.asin(x)),
    acos: (x: any) => fromRadians(mathEngine.acos(x)),
    atan: (x: any) => fromRadians(mathEngine.atan(x)),
    atan2: (y: any, x: any) => fromRadians(mathEngine.atan2(y, x)),
    sinh: (x: any) => mathEngine.sinh(x),
    cosh: (x: any) => mathEngine.cosh(x),
    tanh: (x: any) => mathEngine.tanh(x),
    asinh: (x: any) => mathEngine.asinh(x),
    acosh: (x: any) => mathEngine.acosh(x),
    atanh: (x: any) => mathEngine.atanh(x),
    radians: (x: any) => mathEngine.multiply(x, mathEngine.divide(mathEngine.pi, 180)),
    degrees: (x: any) => mathEngine.multiply(x, mathEngine.divide(180, mathEngine.pi)),
    real: (x: any) => mathEngine.re(x),
    imag: (x: any) => mathEngine.im(x),
    phase: (x: any) => fromRadians(mathEngine.arg(x)),
    polar: (x: any) => mathEngine.complex({ r: mathEngine.abs(x), phi: mathEngine.arg(x) }),
    cart: (x: any) => mathEngine.complex(x),
    average: (...args: any[]) => mathEngine.mean(flatten(args)),
    mean: (...args: any[]) => mathEngine.mean(flatten(args)),
    geomean: (...args: any[]) => mathEngine.geometricMean(flatten(args)),
    median: (...args: any[]) => mathEngine.median(flatten(args)),
    min: (...args: any[]) => mathEngine.min(...flatten(args)),
    max: (...args: any[]) => mathEngine.max(...flatten(args)),
    sum: (...args: any[]) => mathEngine.sum(...flatten(args)),
    product: (...args: any[]) => mathEngine.prod(flatten(args)),
    variance: (...args: any[]) => mathEngine.variance(flatten(args)),
    stddev: (...args: any[]) => mathEngine.std(flatten(args)),
    gcd: (...args: any[]) => flatten(args).reduce((acc: any, value: any) => mathEngine.gcd(acc, value)),
    lcm: (...args: any[]) => flatten(args).reduce((acc: any, value: any) => mathEngine.lcm(acc, value)),
    mod: (x: any, y: any) => mathEngine.mod(x, y),
    idiv: (x: any, y: any) => mathEngine.floor(mathEngine.divide(x, y)),
    and: (x: any, y: any) => mathEngine.bitAnd(x, y),
    or: (x: any, y: any) => mathEngine.bitOr(x, y),
    xor: (x: any, y: any) => mathEngine.bitXor(x, y),
    not: (x: any) => mathEngine.bitNot(x),
    shl: (x: any, bits: any) => mathEngine.leftShift(x, bits),
    shr: (x: any, bits: any) => mathEngine.rightArithShift(x, bits),
    ncr: (n: any, r: any) => combinations(n, r),
    npr: (n: any, r: any) => permutations(n, r),
    gamma: (x: any) => gamma(x),
    gammafn: (x: any) => gamma(x),
    lngamma: (x: any) => mathEngine.log(mathEngine.abs(gamma(x))),
    erf: (x: any) => asBigNumber(mathEngine.erf(numeric(x))),
    erfc: (x: any) => asBigNumber(mathEngine.erfc(numeric(x))),
    bin: (x: any) => `0b${mathEngine.number(x).toString(2)}`,
    oct: (x: any) => `0o${mathEngine.number(x).toString(8)}`,
    hex: (x: any) => `0x${mathEngine.number(x).toString(16)}`,
    dec: (x: any) => `${mathEngine.number(x)}`,
    binompmf: (k: any, n: any, p: any) => binomialPmf(k, n, p),
    binomcdf: (k: any, n: any, p: any) => {
      let total = asBigNumber(0);
      for (let i = 0; i <= numeric(k); i++) total = mathEngine.add(total, binomialPmf(i, n, p));
      return total;
    },
    binommean: (n: any, p: any) => asBigNumber(numeric(n) * numeric(p)),
    binomvar: (n: any, p: any) => asBigNumber(numeric(n) * numeric(p) * (1 - numeric(p))),
    poipmf: (k: any, lambda: any) => poissonPmf(k, lambda),
    poicdf: (k: any, lambda: any) => {
      let total = asBigNumber(0);
      for (let i = 0; i <= numeric(k); i++) total = mathEngine.add(total, poissonPmf(i, lambda));
      return total;
    },
    poimean: (lambda: any) => asBigNumber(numeric(lambda)),
    poivar: (lambda: any) => asBigNumber(numeric(lambda)),
    hyperpmf: (k: any, population: any, successStates: any, draws: any) => hyperPmf(k, population, successStates, draws),
    hypercdf: (k: any, population: any, successStates: any, draws: any) => {
      let total = asBigNumber(0);
      for (let i = 0; i <= numeric(k); i++) total = mathEngine.add(total, hyperPmf(i, population, successStates, draws));
      return total;
    },
    hypermean: (population: any, successStates: any, draws: any) => asBigNumber((numeric(draws) * numeric(successStates)) / numeric(population)),
    hypervar: (population: any, successStates: any, draws: any) => {
      const N = numeric(population);
      const K = numeric(successStates);
      const n = numeric(draws);
      return asBigNumber(n * (K / N) * (1 - K / N) * ((N - n) / (N - 1)));
    },
  };
}

export const mathFunctionDocs: MathFunctionDoc[] = [
  { name: "abs", summary: "Absolute value.", example: "abs(-5)" },
  { name: "sqrt", summary: "Square root.", example: "sqrt(2)" },
  { name: "cbrt", summary: "Cube root.", example: "cbrt(27)" },
  { name: "ln", summary: "Natural logarithm.", example: "ln(e)" },
  { name: "log", summary: "Base-10 logarithm.", example: "log(1000)" },
  { name: "lb", summary: "Base-2 logarithm.", example: "lb(256)" },
  { name: "logn", summary: "Logarithm in a custom base.", example: "logn(3, 81)" },
  { name: "sin", summary: "Sine using the selected angle unit.", example: "sin(90)" },
  { name: "cos", summary: "Cosine using the selected angle unit.", example: "cos(60)" },
  { name: "tan", summary: "Tangent using the selected angle unit.", example: "tan(45)" },
  { name: "asin", summary: "Inverse sine, returned in the selected angle unit.", example: "asin(1)" },
  { name: "atan2", summary: "Two-argument inverse tangent.", example: "atan2(1, 1)" },
  { name: "sinh", summary: "Hyperbolic sine.", example: "sinh(1)" },
  { name: "gamma", summary: "Gamma function.", example: "gamma(5.5)" },
  { name: "erf", summary: "Error function.", example: "erf(1)" },
  { name: "average", summary: "Arithmetic mean.", example: "average(1, 2, 3, 4)" },
  { name: "variance", summary: "Variance of values.", example: "variance(1, 2, 3, 4)" },
  { name: "stddev", summary: "Standard deviation of values.", example: "stddev(1, 2, 3, 4)" },
  { name: "geomean", summary: "Geometric mean.", example: "geomean(2, 8)" },
  { name: "ncr", summary: "Combinations n choose r.", example: "ncr(10, 3)" },
  { name: "npr", summary: "Permutations of n items taken r.", example: "npr(10, 3)" },
  { name: "gcd", summary: "Greatest common divisor.", example: "gcd(84, 30)" },
  { name: "lcm", summary: "Least common multiple.", example: "lcm(6, 8)" },
  { name: "idiv", summary: "Integer division.", example: "idiv(17, 5)" },
  { name: "mod", summary: "Modulo.", example: "mod(17, 5)" },
  { name: "real", summary: "Real part of a complex value.", example: "real(3 + 4i)" },
  { name: "imag", summary: "Imaginary part of a complex value.", example: "imag(3 + 4i)" },
  { name: "phase", summary: "Phase/argument of a complex value.", example: "phase(1 + i)" },
  { name: "binompmf", summary: "Binomial PMF with arguments k, n, p.", example: "binompmf(3, 10, 0.5)" },
  { name: "binomcdf", summary: "Binomial CDF with arguments k, n, p.", example: "binomcdf(3, 10, 0.5)" },
  { name: "poipmf", summary: "Poisson PMF with arguments k, lambda.", example: "poipmf(4, 2.2)" },
  { name: "poicdf", summary: "Poisson CDF with arguments k, lambda.", example: "poicdf(4, 2.2)" },
  { name: "hyperpmf", summary: "Hypergeometric PMF with arguments k, population, successStates, draws.", example: "hyperpmf(2, 20, 5, 4)" },
  { name: "radians", summary: "Convert degrees to radians.", example: "radians(180)" },
  { name: "degrees", summary: "Convert radians to degrees.", example: "degrees(pi)" },
];

export const mathConstantDocs: MathConstantDoc[] = [
  { name: "pi", valueExpression: "pi", summary: "Ratio of a circle's circumference to its diameter.", aliases: ["π"] },
  { name: "e", valueExpression: "e", summary: "Euler's number.", aliases: ["ℯ"] },
  { name: "tau", valueExpression: "2 * pi", summary: "Turn constant 2π.", aliases: ["τ"] },
  { name: "phi", valueExpression: "(1 + sqrt(5)) / 2", summary: "Golden ratio.", aliases: ["φ", "golden_ratio"] },
  { name: "i", valueExpression: "i", summary: "Imaginary unit.", aliases: ["j"] },
  { name: "c", valueExpression: "299792458 m / s", summary: "Speed of light in vacuum." },
  { name: "G", valueExpression: "6.67430e-11 m^3 / (kg s^2)", summary: "Gravitational constant." },
  { name: "h", valueExpression: "6.62607015e-34 J s", summary: "Planck constant." },
  { name: "hbar", valueExpression: "1.054571817e-34 J s", summary: "Reduced Planck constant.", aliases: ["ħ"] },
  { name: "k", valueExpression: "1.380649e-23 J / K", summary: "Boltzmann constant." },
  { name: "epsilon0", valueExpression: "8.8541878128e-12 F / m", summary: "Electric constant (vacuum permittivity)." },
  { name: "mu0", valueExpression: "1.25663706212e-6 N / A^2", summary: "Magnetic constant (vacuum permeability)." },
  { name: "Z0", valueExpression: "376.730313412 ohm", summary: "Characteristic impedance of vacuum." },
  { name: "qe", valueExpression: "1.602176634e-19 C", summary: "Elementary charge.", aliases: ["electron_charge", "elementary_charge"] },
  { name: "NA", valueExpression: "6.02214076e23 / mol", summary: "Avogadro constant.", aliases: ["avogadro"] },
  { name: "R", valueExpression: "8.314462618 J / (mol K)", summary: "Molar gas constant." },
  { name: "F", valueExpression: "96485.33212 C / mol", summary: "Faraday constant." },
  { name: "sigma", valueExpression: "5.670374419e-8 W / (m^2 K^4)", summary: "Stefan-Boltzmann constant." },
  { name: "alpha", valueExpression: "7.2973525693e-3", summary: "Fine-structure constant." },
  { name: "bohr_radius", valueExpression: "5.2917721067e-11 m", summary: "Bohr radius." },
  { name: "electron_mass", valueExpression: "9.1093837015e-31 kg", summary: "Electron mass." },
  { name: "proton_mass", valueExpression: "1.67262192369e-27 kg", summary: "Proton mass." },
  { name: "neutron_mass", valueExpression: "1.67492749804e-27 kg", summary: "Neutron mass." },
  { name: "atomic_mass", valueExpression: "1.66053906660e-27 kg", summary: "Atomic mass constant." },
  { name: "rydberg", valueExpression: "10973731.568160 / m", summary: "Rydberg constant." },
  { name: "au", valueExpression: "149597870700 m", summary: "Astronomical unit." },
  { name: "light_year", valueExpression: "9.4607304725808e15 m", summary: "Light year." },
  { name: "parsec", valueExpression: "3.08567758149137e16 m", summary: "Parsec." },
  { name: "earth_mass", valueExpression: "5.9722e24 kg", summary: "Earth mass." },
  { name: "sun_mass", valueExpression: "1.98847e30 kg", summary: "Solar mass." },
  { name: "g0", valueExpression: "9.80665 m / s^2", summary: "Standard gravity." },
  { name: "julian_year", valueExpression: "365.25 day", summary: "Julian year." },
  { name: "gregorian_year", valueExpression: "365.2425 day", summary: "Gregorian year." },
  { name: "tropical_year", valueExpression: "365.2422 day", summary: "Tropical year." },
];

const digitalStorageUnits: LinearUnitDefinition[] = [
  { canonical: "bit", factor: 1 / 8, aliases: ["bit", "bits", "b"] },
  { canonical: "byte", factor: 1, aliases: ["byte", "bytes", "B"] },
  { canonical: "KB", factor: 1_000, aliases: ["kb", "kilobyte", "kilobytes", "kbyte"] },
  { canonical: "KiB", factor: 1024, aliases: ["kib", "kibibyte", "kibibytes"] },
  { canonical: "MB", factor: 1_000_000, aliases: ["mb", "megabyte", "megabytes", "mbyte"] },
  { canonical: "MiB", factor: 1024 ** 2, aliases: ["mib", "mebibyte", "mebibytes"] },
  { canonical: "GB", factor: 1_000_000_000, aliases: ["gb", "gigabyte", "gigabytes", "gbyte"] },
  { canonical: "GiB", factor: 1024 ** 3, aliases: ["gib", "gibibyte", "gibibytes"] },
  { canonical: "TB", factor: 1_000_000_000_000, aliases: ["tb", "terabyte", "terabytes", "tbyte"] },
  { canonical: "TiB", factor: 1024 ** 4, aliases: ["tib", "tebibyte", "tebibytes"] },
  { canonical: "PB", factor: 1_000_000_000_000_000, aliases: ["pb", "petabyte", "petabytes", "pbyte"] },
  { canonical: "PiB", factor: 1024 ** 5, aliases: ["pib", "pebibyte", "pebibytes"] },
];

const areaUnits: LinearUnitDefinition[] = [
  { canonical: "m^2", factor: 1, aliases: ["m2", "m^2", "square meter", "square meters", "sq meter", "sq meters", "sqm"] },
  { canonical: "km^2", factor: 1_000_000, aliases: ["km2", "km^2", "square kilometer", "square kilometers", "square kilometre", "square kilometres", "sq km", "sq kilometer", "sq kilometre", "sq km"] },
  { canonical: "cm^2", factor: 0.0001, aliases: ["cm2", "cm^2", "square centimeter", "square centimeters", "square centimetre", "square centimetres", "sq cm"] },
  { canonical: "hectare", factor: 10_000, aliases: ["hectare", "hectares", "ha"] },
  { canonical: "mi^2", factor: 2_589_988.110336, aliases: ["mi2", "mi^2", "square mile", "square miles", "sq mile", "sq miles"] },
  { canonical: "yd^2", factor: 0.83612736, aliases: ["yd2", "yd^2", "square yard", "square yards", "sq yard", "sq yards"] },
  { canonical: "ft^2", factor: 0.09290304, aliases: ["ft2", "ft^2", "square foot", "square feet", "sq foot", "sq feet", "sq ft"] },
  { canonical: "in^2", factor: 0.00064516, aliases: ["in2", "in^2", "square inch", "square inches", "sq inch", "sq inches"] },
  { canonical: "acre", factor: 4046.8564224, aliases: ["acre", "acres"] },
];

const lengthUnits: LinearUnitDefinition[] = [
  { canonical: "m", factor: 1, aliases: ["m", "meter", "meters", "metre", "metres"] },
  { canonical: "km", factor: 1000, aliases: ["km", "kilometer", "kilometers", "kilometre", "kilometres"] },
  { canonical: "cm", factor: 0.01, aliases: ["cm", "centimeter", "centimeters", "centimetre", "centimetres"] },
  { canonical: "mm", factor: 0.001, aliases: ["mm", "millimeter", "millimeters", "millimetre", "millimetres"] },
  { canonical: "um", factor: 1e-6, aliases: ["um", "µm", "micrometer", "micrometers", "micrometre", "micrometres"] },
  { canonical: "nm", factor: 1e-9, aliases: ["nm", "nanometer", "nanometers", "nanometre", "nanometres"] },
  { canonical: "in", factor: 0.0254, aliases: ["in", "inch", "inches"] },
  { canonical: "ft", factor: 0.3048, aliases: ["ft", "foot", "feet"] },
  { canonical: "yd", factor: 0.9144, aliases: ["yd", "yard", "yards"] },
  { canonical: "mi", factor: 1609.344, aliases: ["mi", "mile", "miles", "mph mile"] },
  { canonical: "nmi", factor: 1852, aliases: ["nmi", "nautical mile", "nautical miles", "knot mile"] },
  { canonical: "fur", factor: 201.168, aliases: ["fur", "furlong", "furlongs"] },
  { canonical: "au", factor: 149597870700, aliases: ["au", "astronomical unit", "astronomical units"] },
  { canonical: "ly", factor: 9.4607304725808e15, aliases: ["ly", "light year", "light years"] },
  { canonical: "pc", factor: 3.08567758149137e16, aliases: ["pc", "parsec", "parsecs"] },
];

const massUnits: LinearUnitDefinition[] = [
  { canonical: "kg", factor: 1, aliases: ["kg", "kilogram", "kilograms"] },
  { canonical: "g", factor: 0.001, aliases: ["g", "gram", "grams"] },
  { canonical: "mg", factor: 1e-6, aliases: ["mg", "milligram", "milligrams"] },
  { canonical: "ug", factor: 1e-9, aliases: ["ug", "µg", "microgram", "micrograms"] },
  { canonical: "lb", factor: 0.45359237, aliases: ["lb", "lbs", "pound", "pounds"] },
  { canonical: "oz", factor: 0.028349523125, aliases: ["oz", "ounce", "ounces"] },
  { canonical: "grain", factor: 0.00006479891, aliases: ["grain", "grains", "gr"] },
  { canonical: "stone", factor: 6.35029318, aliases: ["stone", "stones", "st"] },
  { canonical: "tonne", factor: 1000, aliases: ["tonne", "tonnes", "metric ton", "metric tons", "t"] },
  { canonical: "ton_us", factor: 907.18474, aliases: ["ton us", "us ton", "short ton", "tons us", "ton (us)"] },
  { canonical: "ton_uk", factor: 1016.0469088, aliases: ["ton uk", "uk ton", "long ton", "tons uk", "ton (uk)"] },
];

const energyUnits: LinearUnitDefinition[] = [
  { canonical: "J", factor: 1, aliases: ["j", "joule", "joules"] },
  { canonical: "kJ", factor: 1000, aliases: ["kj", "kilojoule", "kilojoules"] },
  { canonical: "cal", factor: 4.184, aliases: ["cal", "calorie", "calories"] },
  { canonical: "kcal", factor: 4184, aliases: ["kcal", "kilocalorie", "kilocalories", "calorie food", "cal"] },
  { canonical: "BTU", factor: 1055.05585262, aliases: ["btu", "british thermal unit", "british thermal units"] },
  { canonical: "ft*lbf", factor: 1.3558179483314004, aliases: ["ft-lbf", "ft lbf", "foot pound-force", "foot pounds-force"] },
  { canonical: "in*lbf", factor: 0.1129848290276167, aliases: ["in-lbf", "in lbf", "inch pound-force", "inch pounds-force"] },
  { canonical: "Wh", factor: 3600, aliases: ["wh", "watt hour", "watt hours"] },
  { canonical: "kWh", factor: 3_600_000, aliases: ["kwh", "kilowatt hour", "kilowatt hours"] },
];

const powerUnits: LinearUnitDefinition[] = [
  { canonical: "W", factor: 1, aliases: ["w", "watt", "watts"] },
  { canonical: "kW", factor: 1000, aliases: ["kw", "kilowatt", "kilowatts"] },
  { canonical: "MW", factor: 1_000_000, aliases: ["mw", "megawatt", "megawatts"] },
  { canonical: "GW", factor: 1_000_000_000, aliases: ["gw", "gigawatt", "gigawatts"] },
  { canonical: "hp_mechanical", factor: 745.6998715822702, aliases: ["hp", "mechanical horsepower", "horsepower mechanical", "hp mechanical"] },
  { canonical: "hp_metric", factor: 735.49875, aliases: ["metric horsepower", "horsepower metric", "hp metric"] },
  { canonical: "ft*lbf/s", factor: 1.3558179483314004, aliases: ["ft-lbf/second", "ft lbf/s", "foot pound-force per second"] },
  { canonical: "cal/s", factor: 4.184, aliases: ["cal/s", "calorie/second", "calories/second"] },
  { canonical: "btu/s", factor: 1055.05585262, aliases: ["btu/s", "btu/second", "british thermal unit per second"] },
  { canonical: "VA", factor: 1, aliases: ["va", "volt ampere", "volt-amperes"] },
  { canonical: "kVA", factor: 1000, aliases: ["kva", "kilovolt ampere", "kilovolt-amperes"] },
];

const pressureUnits: LinearUnitDefinition[] = [
  { canonical: "Pa", factor: 1, aliases: ["pa", "pascal", "pascals"] },
  { canonical: "kPa", factor: 1000, aliases: ["kpa", "kilopascal", "kilopascals"] },
  { canonical: "MPa", factor: 1_000_000, aliases: ["mpa", "megapascal", "megapascals"] },
  { canonical: "bar", factor: 100_000, aliases: ["bar", "bars"] },
  { canonical: "psi", factor: 6894.757293168361, aliases: ["psi"] },
  { canonical: "psf", factor: 47.88025898033584, aliases: ["psf"] },
  { canonical: "atm", factor: 101325, aliases: ["atm", "atmosphere", "atmospheres"] },
  { canonical: "at", factor: 98066.5, aliases: ["technical atmosphere", "technical atmospheres", "at"] },
  { canonical: "mmHg", factor: 133.322387415, aliases: ["mmhg", "millimeter mercury", "millimeters of mercury"] },
  { canonical: "torr", factor: 133.32236842105263, aliases: ["torr"] },
];

const speedUnits: LinearUnitDefinition[] = [
  { canonical: "m/s", factor: 1, aliases: ["m/s", "meter/second", "meters/second", "metre/second", "metres/second"] },
  { canonical: "km/h", factor: 1000 / 3600, aliases: ["km/h", "kph", "kilometer/hour", "kilometers/hour", "kilometre/hour", "kilometres/hour"] },
  { canonical: "mph", factor: 1609.344 / 3600, aliases: ["mph", "mile/hour", "miles/hour"] },
  { canonical: "ft/s", factor: 0.3048, aliases: ["ft/s", "foot/second", "feet/second"] },
  { canonical: "knot", factor: 1852 / 3600, aliases: ["knot", "knots", "kt", "kts"] },
];

const timeUnits: LinearUnitDefinition[] = [
  { canonical: "ns", factor: 1e-9, aliases: ["ns", "nanosecond", "nanoseconds"] },
  { canonical: "us", factor: 1e-6, aliases: ["us", "µs", "microsecond", "microseconds"] },
  { canonical: "ms", factor: 1e-3, aliases: ["ms", "millisecond", "milliseconds"] },
  { canonical: "s", factor: 1, aliases: ["s", "sec", "second", "seconds"] },
  { canonical: "min", factor: 60, aliases: ["min", "minute", "minutes"] },
  { canonical: "h", factor: 3600, aliases: ["h", "hr", "hour", "hours"] },
  { canonical: "day", factor: 86400, aliases: ["day", "days"] },
  { canonical: "week", factor: 604800, aliases: ["week", "weeks"] },
  { canonical: "month", factor: 2629800, aliases: ["month", "months"] },
  { canonical: "year", factor: 31556952, aliases: ["year", "years"] },
  { canonical: "julian_year", factor: 31557600, aliases: ["julian year", "julian years"] },
  { canonical: "gregorian_year", factor: 31556952, aliases: ["gregorian year", "gregorian years"] },
  { canonical: "tropical_year", factor: 31556925.216, aliases: ["tropical year", "tropical years"] },
];

const torqueUnits: LinearUnitDefinition[] = [
  { canonical: "N*m", factor: 1, aliases: ["n m", "n*m", "nm torque", "newton meter", "newton meters"] },
  { canonical: "ft*lbf", factor: 1.3558179483314004, aliases: ["ft-lbf", "ft lbf", "foot pound-force", "foot pounds-force"] },
  { canonical: "in*lbf", factor: 0.1129848290276167, aliases: ["in-lbf", "in lbf", "inch pound-force", "inch pounds-force"] },
];

const volumeUnits: LinearUnitDefinition[] = [
  { canonical: "L", factor: 1, aliases: ["l", "liter", "liters", "litre", "litres"] },
  { canonical: "mL", factor: 0.001, aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"] },
  { canonical: "m^3", factor: 1000, aliases: ["m3", "m^3", "cubic meter", "cubic meters", "cubic metre", "cubic metres"] },
  { canonical: "cm^3", factor: 0.001, aliases: ["cm3", "cm^3", "cubic centimeter", "cubic centimeters", "cubic centimetre", "cubic centimetres", "cc"] },
  { canonical: "in^3", factor: 0.016387064, aliases: ["in3", "in^3", "cubic inch", "cubic inches"] },
  { canonical: "ft^3", factor: 28.316846592, aliases: ["ft3", "ft^3", "cubic foot", "cubic feet"] },
  { canonical: "yd^3", factor: 764.554857984, aliases: ["yd3", "yd^3", "cubic yard", "cubic yards"] },
  { canonical: "tsp_us", factor: 0.00492892159375, aliases: ["tsp", "teaspoon", "teaspoons", "us teaspoon", "teaspoon us"] },
  { canonical: "tbsp_us", factor: 0.01478676478125, aliases: ["tbsp", "tablespoon", "tablespoons", "us tablespoon", "tablespoon us"] },
  { canonical: "cup_us", factor: 0.2365882365, aliases: ["cup", "cups", "us cup", "cup us"] },
  { canonical: "floz_us", factor: 0.0295735295625, aliases: ["fluid ounce", "fluid ounces", "fl oz", "fl oz us", "fluid ounce us"] },
  { canonical: "floz_uk", factor: 0.0284130625, aliases: ["fl oz uk", "fluid ounce uk", "fluid ounces uk"] },
  { canonical: "pint_us", factor: 0.473176473, aliases: ["pint", "pints", "pint us", "us pint"] },
  { canonical: "pint_uk", factor: 0.56826125, aliases: ["pint uk", "uk pint"] },
  { canonical: "quart_us", factor: 0.946352946, aliases: ["quart", "quarts", "quart us", "us quart"] },
  { canonical: "quart_uk", factor: 1.1365225, aliases: ["quart uk", "uk quart"] },
  { canonical: "gallon_us", factor: 3.785411784, aliases: ["gallon", "gallons", "gallon us", "us gallon"] },
  { canonical: "gallon_uk", factor: 4.54609, aliases: ["gallon uk", "uk gallon"] },
];

const linearUnitCategoryDefinitions: Record<Exclude<UnitCategory, "currency" | "fuel" | "temperature" | "cooking">, LinearUnitDefinition[]> = {
  area: areaUnits,
  digital_storage: digitalStorageUnits,
  energy: energyUnits,
  length: lengthUnits,
  mass: massUnits,
  power: powerUnits,
  pressure: pressureUnits,
  speed: speedUnits,
  time: timeUnits,
  torque: torqueUnits,
  volume: volumeUnits,
};

const cookingUnits = volumeUnits.filter((entry) => /tsp|tbsp|cup|floz|pint|quart|gallon|ml|l/i.test(entry.canonical));

function buildUnitAliasLookup(entries: LinearUnitDefinition[]): Map<string, LinearUnitDefinition> {
  const map = new Map<string, LinearUnitDefinition>();
  for (const entry of entries) {
    map.set(normalizeUnitKey(entry.canonical), entry);
    for (const alias of entry.aliases) {
      map.set(normalizeUnitKey(alias), entry);
    }
  }
  return map;
}

const unitAliasLookups: Record<string, Map<string, LinearUnitDefinition>> = Object.fromEntries(
  Object.entries({ ...linearUnitCategoryDefinitions, cooking: cookingUnits }).map(([category, entries]) => [category, buildUnitAliasLookup(entries)]),
) as Record<string, Map<string, LinearUnitDefinition>>;

export function getMathToolReference(includeDetailedValues = false): Record<string, unknown> {
  return {
    overview: "Evaluate expressions, persist definitions, reuse ans/last, and inspect built-in functions and constants.",
    functions: mathFunctionDocs.map((entry) => includeDetailedValues ? entry : { name: entry.name, summary: entry.summary, example: entry.example }),
    constants: mathConstantDocs.map((entry) => includeDetailedValues
      ? entry
      : { name: entry.name, summary: entry.summary, aliases: entry.aliases || [] }),
    notes: [
      "Use mode=evaluate for expressions and assignments.",
      "Use mode=list_functions or mode=list_constants for tool-native discovery.",
      "ans and last reference the previous result in the current conversation scope.",
    ],
  };
}

export function getUnitConversionToolReference(includeDetailedValues = false): Record<string, unknown> {
  const categories = [
    "auto",
    "area",
    "currency",
    "digital_storage",
    "energy",
    "fuel",
    "length",
    "mass",
    "power",
    "pressure",
    "speed",
    "temperature",
    "time",
    "torque",
    "volume",
    "cooking",
  ];
  return {
    overview: "Convert between supported unit families and currencies, or inspect categories and aliases.",
    categories,
    unitsByCategory: Object.fromEntries(
      Object.entries({ ...linearUnitCategoryDefinitions, cooking: cookingUnits }).map(([category, entries]) => [
        category,
        entries.map((entry) => includeDetailedValues
          ? { canonical: entry.canonical, factor: entry.factor, aliases: entry.aliases }
          : { canonical: entry.canonical, aliases: entry.aliases }),
      ]),
    ),
    specialCategories: {
      temperature: ["C", "F", "K"],
      fuel: ["mpg", "km/l", "l/100km"],
      currency: "Resolved from exchange-rate data.",
    },
    notes: [
      "Use operation=convert for conversions.",
      "Use operation=list_categories or operation=list_units for tool-native discovery.",
      "Category auto attempts to infer the right unit family from the inputs.",
    ],
  };
}

const currencyNameFallbacks = ["USD", "EUR", "GBP", "JPY", "BRL", "CAD", "AUD", "CHF", "CNY", "INR", "KRW", "MXN", "ARS", "ZAR"];

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const excelEpochMs = Date.UTC(1899, 11, 30);
const julianUnixEpoch = 2440587.5;

function dateMathLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function assertValidTimeZone(timeZone: string): string {
  const value = String(timeZone || "").trim() || dateMathLocalTimeZone();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    throw new Error(`Invalid IANA timezone: ${value}`);
  }
}

function parseIsoLikeLocalDateTime(value: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number } | null {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?)?$/);
  if (!match) return null;
  const millisecond = match[7] ? Number(match[7].slice(0, 3).padEnd(3, "0")) : 0;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
    millisecond,
  };
}

function getZonedParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number; weekday: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: date.getUTCMilliseconds(),
    weekday: String(parts.weekday || ""),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, date.getUTCMilliseconds());
  return asUtc - date.getTime();
}

function zonedPartsToUtc(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number; millisecond?: number }, timeZone: string): Date {
  let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, parts.millisecond || 0);
  for (let i = 0; i < 4; i++) {
    const offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const next = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, parts.millisecond || 0) - offset;
    if (next === utcMs) break;
    utcMs = next;
  }
  return new Date(utcMs);
}

function parseDateValue(value: string, inputType: DateInputType, timeZone: string): Date {
  const raw = String(value || "").trim();
  if (!raw && inputType !== "auto") throw new Error("date is required.");
  const type = inputType === "auto"
    ? (/^-?\d+(\.\d+)?$/.test(raw)
      ? (Math.abs(Number(raw)) > 10_000_000_000 ? "unix_milliseconds" : "unix_seconds")
      : "iso")
    : inputType;
  let date: Date;
  if (type === "unix_seconds") date = new Date(Number(raw) * 1000);
  else if (type === "unix_milliseconds") date = new Date(Number(raw));
  else if (type === "excel_serial") date = new Date(excelEpochMs + Number(raw) * 86400_000);
  else if (type === "julian_day") date = new Date((Number(raw) - julianUnixEpoch) * 86400_000);
  else {
    const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    if (hasExplicitZone) {
      date = new Date(raw);
    } else {
      const localParts = parseIsoLikeLocalDateTime(raw);
      date = localParts ? zonedPartsToUtc(localParts, timeZone) : new Date(raw);
    }
  }
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date value: ${value}`);
  return date;
}

function parseYearInput(value: string, inputType: DateInputType): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (inputType !== "auto" && inputType !== "iso") return null;
  if (!/^-?\d{1,6}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayOfYear(parts: { year: number; month: number; day: number }): number {
  const start = Date.UTC(parts.year, 0, 1);
  const current = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.floor((current - start) / 86400_000) + 1;
}

function isoWeek(parts: { year: number; month: number; day: number }): { isoWeekYear: number; isoWeek: number; isoWeekday: number } {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoWeekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoWeekYear, 0, 1));
  const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400_000) + 1) / 7);
  return { isoWeekYear, isoWeek, isoWeekday: day };
}

function parseDurationJson(raw: string, fallbackUnit: string, amount: number): DurationParts {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    const key = String(fallbackUnit || "days").toLowerCase();
    return { [key]: Number(amount || 0) } as DurationParts;
  }
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("duration_json must be a JSON object.");
  const duration: DurationParts = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalized = key.toLowerCase();
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new Error(`Invalid duration value for ${key}.`);
    if (["year", "years"].includes(normalized)) duration.years = numberValue;
    else if (["month", "months"].includes(normalized)) duration.months = numberValue;
    else if (["week", "weeks"].includes(normalized)) duration.weeks = numberValue;
    else if (["day", "days"].includes(normalized)) duration.days = numberValue;
    else if (["hour", "hours"].includes(normalized)) duration.hours = numberValue;
    else if (["minute", "minutes"].includes(normalized)) duration.minutes = numberValue;
    else if (["second", "seconds"].includes(normalized)) duration.seconds = numberValue;
    else if (["millisecond", "milliseconds", "ms"].includes(normalized)) duration.milliseconds = numberValue;
    else throw new Error(`Unsupported duration unit: ${key}`);
  }
  return duration;
}

function addDuration(date: Date, duration: DurationParts, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  const years = Number(duration.years || 0);
  const months = Number(duration.months || 0);
  let targetYear = parts.year + years;
  let targetMonth = parts.month + months;
  while (targetMonth > 12) {
    targetYear += 1;
    targetMonth -= 12;
  }
  while (targetMonth < 1) {
    targetYear -= 1;
    targetMonth += 12;
  }
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
  let result = zonedPartsToUtc({
    year: targetYear,
    month: targetMonth,
    day: targetDay,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: parts.millisecond,
  }, timeZone);
  const calendarDays = Number(duration.days || 0) + Number(duration.weeks || 0) * 7;
  if (calendarDays) {
    const local = getZonedParts(result, timeZone);
    const shiftedDay = new Date(Date.UTC(local.year, local.month - 1, local.day + calendarDays));
    result = zonedPartsToUtc({
      year: shiftedDay.getUTCFullYear(),
      month: shiftedDay.getUTCMonth() + 1,
      day: shiftedDay.getUTCDate(),
      hour: local.hour,
      minute: local.minute,
      second: local.second,
      millisecond: local.millisecond,
    }, timeZone);
  }
  const fixedMs = Number(duration.hours || 0) * 3600_000
    + Number(duration.minutes || 0) * 60_000
    + Number(duration.seconds || 0) * 1000
    + Number(duration.milliseconds || 0);
  return new Date(result.getTime() + fixedMs);
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  const offsetMs = getTimeZoneOffsetMs(date, timeZone);
  const sign = offsetMs >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMs);
  const offsetHours = Math.floor(absolute / 3600_000);
  const offsetMinutes = Math.floor((absolute % 3600_000) / 60_000);
  return `${padNumber(parts.year, 4)}-${padNumber(parts.month, 2)}-${padNumber(parts.day, 2)}T${padNumber(parts.hour, 2)}:${padNumber(parts.minute, 2)}:${padNumber(parts.second, 2)}.${padNumber(parts.millisecond, 3)}${sign}${padNumber(offsetHours, 2)}:${padNumber(offsetMinutes, 2)}`;
}

function padNumber(value: number, width: number): string {
  return String(Math.trunc(value)).padStart(width, "0");
}

function formatDateOutput(date: Date, outputType: DateOutputType, timeZone: string): unknown {
  const parts = getZonedParts(date, timeZone);
  if (outputType === "iso") return date.toISOString();
  if (outputType === "local") return formatDateInTimeZone(date, timeZone);
  if (outputType === "unix_seconds") return date.getTime() / 1000;
  if (outputType === "unix_milliseconds") return date.getTime();
  if (outputType === "excel_serial") return (date.getTime() - excelEpochMs) / 86400_000;
  if (outputType === "julian_day") return date.getTime() / 86400_000 + julianUnixEpoch;
  return {
    ...parts,
    timeZone,
    offsetMinutes: getTimeZoneOffsetMs(date, timeZone) / 60_000,
    dayOfYear: dayOfYear(parts),
    daysInMonth: daysInMonth(parts.year, parts.month),
    leapYear: isLeapYear(parts.year),
    ...isoWeek(parts),
  };
}

function durationBreakdown(ms: number): Record<string, unknown> {
  const sign = ms < 0 ? -1 : 1;
  let remaining = Math.abs(ms);
  const days = Math.floor(remaining / 86400_000);
  remaining -= days * 86400_000;
  const hours = Math.floor(remaining / 3600_000);
  remaining -= hours * 3600_000;
  const minutes = Math.floor(remaining / 60_000);
  remaining -= minutes * 60_000;
  const seconds = Math.floor(remaining / 1000);
  remaining -= seconds * 1000;
  return {
    sign,
    totalMilliseconds: ms,
    totalSeconds: ms / 1000,
    totalMinutes: ms / 60_000,
    totalHours: ms / 3600_000,
    totalDays: ms / 86400_000,
    calendarAgnostic: { days, hours, minutes, seconds, milliseconds: remaining },
  };
}

async function readPersistedMathScope(ctx: ToolModuleContext, statePath: string): Promise<PersistedMathScope> {
  return ctx.readJsonFile<PersistedMathScope>(statePath, { lastResultText: "0", definitions: [] });
}

async function writePersistedMathScope(ctx: ToolModuleContext, statePath: string, scope: PersistedMathScope): Promise<void> {
  await ctx.writeJsonFile(statePath, scope);
}

function extractMathDefinitions(expression: string): MathDefinitionEntry[] {
  const definitions: MathDefinitionEntry[] = [];
  const statements = preprocessMathExpression(expression).split(/[\n;]+/).map((line) => line.trim()).filter(Boolean);
  for (const statement of statements) {
    const match = statement.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*\([^)]*\))?\s*=/);
    if (!match) continue;
    definitions.push({ key: match[1], statement });
  }
  return definitions;
}

function createMathParser(angleUnit: MathAngleUnit) {
  const parser = mathEngine.parser();
  const definitions = getMathFunctionDefinitions(angleUnit);
  for (const [name, fn] of Object.entries(definitions)) {
    parser.set(name, fn);
  }
  for (const doc of mathConstantDocs) {
    try {
      const value = mathEngine.evaluate(doc.valueExpression);
      parser.set(doc.name, value);
      for (const alias of doc.aliases || []) {
        parser.set(alias, value);
      }
    } catch {
      // Keep the parser usable even if a constant definition is malformed.
    }
  }
  return parser;
}

function formatMathResult(value: any, precision = 24): string {
  return mathEngine.format(value, { precision, lowerExp: -12, upperExp: 20 });
}

function classifyMathResult(value: any): string {
  if (mathEngine.isUnit?.(value)) return "unit";
  if (mathEngine.isComplex?.(value)) return "complex";
  if (mathEngine.isBigNumber?.(value)) return "big-number";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function resolveLinearUnit(category: UnitCategory, rawUnit: string): LinearUnitDefinition | null {
  const lookup = unitAliasLookups[category];
  if (!lookup) return null;
  return lookup.get(normalizeUnitKey(rawUnit)) || null;
}

function convertTemperature(amount: number, fromUnitRaw: string, toUnitRaw: string): number {
  const fromUnit = normalizeUnitKey(fromUnitRaw);
  const toUnit = normalizeUnitKey(toUnitRaw);
  const toCelsius = (value: number, unit: string): number => {
    switch (unit) {
      case "c":
      case "celsius": return value;
      case "f":
      case "fahrenheit": return (value - 32) * 5 / 9;
      case "k":
      case "kelvin": return value - 273.15;
      case "rankine": return (value - 491.67) * 5 / 9;
      case "delisle": return 100 - value * 2 / 3;
      case "newton": return value * 100 / 33;
      case "reaumur":
      case "réaumur":
      case "reaumur scale": return value * 5 / 4;
      case "romer":
      case "rømer": return (value - 7.5) * 40 / 21;
      case "gas mark": return (value - 0.25) * (125 / 3) + 121;
      default: throw new Error(`Unsupported temperature unit: ${fromUnitRaw}`);
    }
  };
  const fromCelsius = (value: number, unit: string): number => {
    switch (unit) {
      case "c":
      case "celsius": return value;
      case "f":
      case "fahrenheit": return (value * 9 / 5) + 32;
      case "k":
      case "kelvin": return value + 273.15;
      case "rankine": return (value + 273.15) * 9 / 5;
      case "delisle": return (100 - value) * 3 / 2;
      case "newton": return value * 33 / 100;
      case "reaumur":
      case "réaumur":
      case "reaumur scale": return value * 4 / 5;
      case "romer":
      case "rømer": return value * 21 / 40 + 7.5;
      case "gas mark": return (value - 121) * 3 / 125 + 0.25;
      default: throw new Error(`Unsupported temperature unit: ${toUnitRaw}`);
    }
  };
  return fromCelsius(toCelsius(amount, fromUnit), toUnit);
}

function convertFuel(amount: number, fromUnitRaw: string, toUnitRaw: string): number {
  const normalizeFuel = (unit: string) => normalizeUnitKey(unit)
    .replace(/miles per gallon/gi, "mpg")
    .replace(/miles\/gallon/gi, "mpg")
    .replace(/kilometers per litre/gi, "km/l")
    .replace(/kilometres per litre/gi, "km/l")
    .replace(/miles per litre/gi, "mi/l")
    .replace(/litres per 100 ?km/gi, "l/100km")
    .replace(/liters per 100 ?km/gi, "l/100km");
  const fromUnit = normalizeFuel(fromUnitRaw);
  const toUnit = normalizeFuel(toUnitRaw);
  const toKmPerL = (value: number, unit: string): number => {
    switch (unit) {
      case "km/l": return value;
      case "mi/l": return value * 1.609344;
      case "l/100km": return 100 / value;
      case "mpg us":
      case "mpg": return value * 0.425143707;
      case "mpg uk": return value * 0.35400619;
      default: throw new Error(`Unsupported fuel unit: ${fromUnitRaw}`);
    }
  };
  const fromKmPerL = (value: number, unit: string): number => {
    switch (unit) {
      case "km/l": return value;
      case "mi/l": return value / 1.609344;
      case "l/100km": return 100 / value;
      case "mpg us":
      case "mpg": return value / 0.425143707;
      case "mpg uk": return value / 0.35400619;
      default: throw new Error(`Unsupported fuel unit: ${toUnitRaw}`);
    }
  };
  return fromKmPerL(toKmPerL(amount, fromUnit), toUnit);
}

function convertLinearUnit(amount: number, fromUnit: LinearUnitDefinition, toUnit: LinearUnitDefinition): number {
  return (amount * fromUnit.factor) / toUnit.factor;
}

async function getCurrencyRates(ctx: ToolModuleContext, forceRefresh = false): Promise<{ base: string; fetchedAt: string; rates: Record<string, number>; source: string; stale: boolean; }> {
  const cachePath = path.join(ctx.pluginDataDirectory(), "currency", "rates.json");
  const cached = await ctx.readJsonFile<any>(cachePath, null);
  const cacheAgeMs = cached?.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY;
  if (!forceRefresh && cached?.rates && cacheAgeMs < 3600_000) {
    return { ...cached, stale: false };
  }
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD");
    if (!response.ok) throw new Error(`Currency rate request failed with ${response.status}`);
    const payload = await response.json() as any;
    const data = {
      base: "USD",
      fetchedAt: new Date().toISOString(),
      rates: { USD: 1, ...(payload?.rates || {}) },
      source: "frankfurter",
      stale: false,
    };
    await ctx.fsp.mkdir(path.dirname(cachePath), { recursive: true });
    await ctx.fsp.writeFile(cachePath, JSON.stringify(data, null, 2), "utf8");
    return data;
  } catch (error) {
    if (cached?.rates) {
      return { ...cached, stale: true };
    }
    throw error;
  }
}

function resolveCurrencyCode(input: string, rates: Record<string, number>): string | null {
  const normalized = normalizeUnitKey(input).replace(/\s+/g, " ");
  const codes = Array.from(new Set([...Object.keys(rates), ...currencyNameFallbacks])).sort();
  const displayNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "currency" })
    : null;
  for (const code of codes) {
    if (normalized === code.toLowerCase()) return code;
    const display = displayNames?.of(code);
    if (display && normalizeUnitKey(display) === normalized) return code;
  }
  return null;
}

const unitCategoryList: UnitCategory[] = ["area", "currency", "digital_storage", "energy", "fuel", "length", "mass", "power", "pressure", "speed", "temperature", "time", "torque", "volume", "cooking"];

function listUnitsForCategory(category: UnitCategory): Array<{ canonical: string; aliases: string[] }> {
  if (category === "temperature") {
    return [
      { canonical: "Celsius", aliases: ["C", "celsius"] },
      { canonical: "Fahrenheit", aliases: ["F", "fahrenheit"] },
      { canonical: "Kelvin", aliases: ["K", "kelvin"] },
      { canonical: "Rankine", aliases: ["rankine"] },
      { canonical: "Delisle", aliases: ["delisle"] },
      { canonical: "Newton", aliases: ["newton"] },
      { canonical: "Réaumur", aliases: ["reaumur", "réaumur"] },
      { canonical: "Rømer", aliases: ["romer", "rømer"] },
      { canonical: "Gas Mark", aliases: ["gas mark"] },
    ];
  }
  if (category === "fuel") {
    return [
      { canonical: "mpg us", aliases: ["mpg", "miles per gallon (us)"] },
      { canonical: "mpg uk", aliases: ["miles per gallon (uk)"] },
      { canonical: "l/100km", aliases: ["litres/100km", "liters/100km"] },
      { canonical: "km/l", aliases: ["kilometers/litre", "kilometres/litre"] },
      { canonical: "mi/l", aliases: ["miles/litre", "miles/liter"] },
    ];
  }
  if (category === "currency") {
    return currencyNameFallbacks.map((code) => ({ canonical: code, aliases: [] }));
  }
  const entries = category === "cooking" ? cookingUnits : linearUnitCategoryDefinitions[category as keyof typeof linearUnitCategoryDefinitions];
  return (entries || []).map((entry) => ({ canonical: entry.canonical, aliases: entry.aliases }));
}

export function registerMathAndUnitTools(ctx: ToolModuleContext, tools: any[]): void {
  const { tool, z, safeTool, workspaceRoot, fsp, json, normalize, getConversationStorageContext } = ctx;

  async function resolveMathStatePath(root: string): Promise<string> {
    const context = await getConversationStorageContext(root);
    return mathStateFilePathFromDirectory(context.conversationDirectory);
  }

  tools.push(tool({
    name: "as_math",
    description: "Evaluate precise math expressions. Use this instead of mental arithmetic.",
    parameters: {
      mode: z.enum(["evaluate", "list_functions", "list_constants", "clear_scope"]).default("evaluate"),
      expression: z.string().default(""),
      angle_unit: z.enum(["degrees", "radians"]).default("degrees"),
      query: z.string().default(""),
      detailed: z.boolean().default(false),
    },
    implementation: safeTool("as_math", async ({ mode, expression, angle_unit, query, detailed }) => {
      if (mode === "clear_scope") {
        const statePath = await resolveMathStatePath(workspaceRoot);
        await fsp.rm(statePath, { force: true });
        return json({ success: true, cleared: true });
      }
      if (mode === "list_functions") {
        const filtered = mathFunctionDocs.filter((entry) => {
          const needle = normalize(query as string);
          return !needle || normalize(`${entry.name} ${entry.summary} ${entry.example || ""}`).includes(needle);
        });
        return json({
          count: filtered.length,
          note: "Query only the functions you need.",
          functions: filtered.map((entry) => detailed ? entry : { name: entry.name, summary: entry.summary }),
        });
      }
      if (mode === "list_constants") {
        const filtered = mathConstantDocs.filter((entry) => {
          const needle = normalize(query as string);
          return !needle || normalize(`${entry.name} ${entry.summary} ${(entry.aliases || []).join(" ")}`).includes(needle);
        });
        return json({
          count: filtered.length,
          note: "Use constant names directly in expressions.",
          constants: filtered.map((entry) => detailed ? {
            name: entry.name,
            summary: entry.summary,
            aliases: entry.aliases || [],
            valueText: formatMathResult(mathEngine.evaluate(entry.valueExpression)),
          } : {
            name: entry.name,
            summary: entry.summary,
          }),
        });
      }
      const parser = createMathParser(angle_unit as MathAngleUnit);
      const statePath = await resolveMathStatePath(workspaceRoot);
      const persisted = await readPersistedMathScope(ctx, statePath);
      for (const definition of persisted.definitions || []) {
        try {
          parser.evaluate(definition.statement);
        } catch {}
      }
      if (persisted.lastResultText) {
        try {
          const ansValue = mathEngine.evaluate(persisted.lastResultText);
          parser.set("ans", ansValue);
          parser.set("last", ansValue);
        } catch {
          parser.set("ans", 0);
          parser.set("last", 0);
        }
      } else {
        parser.set("ans", 0);
        parser.set("last", 0);
      }
      const preparedExpression = preprocessMathExpression(expression as string);
      if (!preparedExpression.trim()) {
        throw new Error("expression is required when mode=evaluate.");
      }
      const result = parser.evaluate(preparedExpression);
      const resultText = formatMathResult(result);
      const nextDefinitions = [...(persisted.definitions || [])];
      for (const definition of extractMathDefinitions(preparedExpression)) {
        const existingIndex = nextDefinitions.findIndex((entry) => entry.key === definition.key);
        if (existingIndex >= 0) nextDefinitions.splice(existingIndex, 1);
        nextDefinitions.push(definition);
      }
      await writePersistedMathScope(ctx, statePath, {
        lastResultText: resultText,
        definitions: nextDefinitions,
      });
      const response: Record<string, unknown> = {
        expression: preparedExpression,
        angleUnit: angle_unit,
        resultType: classifyMathResult(result),
        resultText,
        note: "Use as_math for calculations instead of estimating. ans references the previous result in this conversation.",
      };
      if (typeof result === "number" || mathEngine.isBigNumber?.(result)) {
        response.resultNumber = Number(mathEngine.number(result));
      }
      if (detailed) {
        response.persistedDefinitions = nextDefinitions;
      }
      return json(response);
    }),
  }));

  tools.push(tool({
    name: "as_date_math",
    description: "Parse, convert, format, compare, and transform dates/times precisely with timezone, weekday, leap-year, ISO week, Unix, Excel serial, and Julian day support.",
    parameters: {
      operation: z.enum(["info", "convert", "add", "diff", "weekday", "is_leap_year", "month_info", "range", "now", "list_time_zones"]).default("info"),
      date: z.string().default(""),
      end_date: z.string().default(""),
      input_type: z.enum(["auto", "iso", "unix_seconds", "unix_milliseconds", "excel_serial", "julian_day"]).default("auto"),
      output_type: z.enum(["iso", "local", "unix_seconds", "unix_milliseconds", "excel_serial", "julian_day", "parts"]).default("local"),
      timezone: z.string().default(""),
      target_timezone: z.string().default(""),
      amount: z.number().default(0),
      unit: z.enum(["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds"]).default("days"),
      duration_json: z.string().default(""),
      include_end: z.boolean().default(false),
      query: z.string().default(""),
    },
    implementation: safeTool("as_date_math", async ({ operation, date, end_date, input_type, output_type, timezone, target_timezone, amount, unit, duration_json, include_end, query }) => {
      const sourceTimeZone = assertValidTimeZone(String(timezone || "") || dateMathLocalTimeZone());
      const outputTimeZone = assertValidTimeZone(String(target_timezone || "") || sourceTimeZone);

      if (operation === "list_time_zones") {
        const zones = typeof (Intl as any).supportedValuesOf === "function"
          ? (Intl as any).supportedValuesOf("timeZone")
          : ["UTC", dateMathLocalTimeZone(), "America/New_York", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney"];
        const needle = normalize(query as string);
        const filtered = zones.filter((zone: string) => !needle || normalize(zone).includes(needle));
        return json({ count: filtered.length, timeZones: filtered.slice(0, 500) });
      }

      if (operation === "is_leap_year") {
        const explicitYear = parseYearInput(date as string, input_type as DateInputType);
        if (explicitYear !== null) {
          return json({
            operation,
            year: explicitYear,
            leapYear: isLeapYear(explicitYear),
            daysInYear: isLeapYear(explicitYear) ? 366 : 365,
          });
        }
      }

      const now = new Date();
      const baseDate = operation === "now"
        ? now
        : parseDateValue(date as string, input_type as DateInputType, sourceTimeZone);
      const parts = getZonedParts(baseDate, outputTimeZone);
      const iso = isoWeek(parts);
      const baseInfo = {
        input: operation === "now" ? "now" : date,
        inputType: input_type,
        sourceTimeZone,
        outputTimeZone,
        utcIso: baseDate.toISOString(),
        local: formatDateInTimeZone(baseDate, outputTimeZone),
        unixSeconds: baseDate.getTime() / 1000,
        unixMilliseconds: baseDate.getTime(),
        excelSerial: (baseDate.getTime() - excelEpochMs) / 86400_000,
        julianDay: baseDate.getTime() / 86400_000 + julianUnixEpoch,
        weekday: parts.weekday || weekdayNames[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()],
        dayOfYear: dayOfYear(parts),
        daysInMonth: daysInMonth(parts.year, parts.month),
        leapYear: isLeapYear(parts.year),
        ...iso,
        parts,
      };

      if (operation === "now" || operation === "info" || operation === "weekday") {
        return json({
          operation,
          ...baseInfo,
          result: operation === "weekday" ? baseInfo.weekday : formatDateOutput(baseDate, output_type as DateOutputType, outputTimeZone),
        });
      }

      if (operation === "convert") {
        return json({
          operation,
          ...baseInfo,
          outputType: output_type,
          result: formatDateOutput(baseDate, output_type as DateOutputType, outputTimeZone),
        });
      }

      if (operation === "is_leap_year") {
        return json({
          operation,
          year: parts.year,
          leapYear: isLeapYear(parts.year),
          daysInYear: isLeapYear(parts.year) ? 366 : 365,
        });
      }

      if (operation === "month_info") {
        return json({
          operation,
          year: parts.year,
          month: parts.month,
          daysInMonth: daysInMonth(parts.year, parts.month),
          firstDay: getZonedParts(zonedPartsToUtc({ year: parts.year, month: parts.month, day: 1 }, outputTimeZone), outputTimeZone).weekday,
          lastDay: getZonedParts(zonedPartsToUtc({ year: parts.year, month: parts.month, day: daysInMonth(parts.year, parts.month) }, outputTimeZone), outputTimeZone).weekday,
          leapYear: isLeapYear(parts.year),
        });
      }

      if (operation === "add") {
        const duration = parseDurationJson(duration_json as string, unit as string, amount as number);
        const resultDate = addDuration(baseDate, duration, sourceTimeZone);
        return json({
          operation,
          source: baseInfo,
          duration,
          outputType: output_type,
          result: formatDateOutput(resultDate, output_type as DateOutputType, outputTimeZone),
          resultInfo: {
            utcIso: resultDate.toISOString(),
            local: formatDateInTimeZone(resultDate, outputTimeZone),
            parts: getZonedParts(resultDate, outputTimeZone),
          },
        });
      }

      if (operation === "diff" || operation === "range") {
        const other = parseDateValue(end_date as string, input_type as DateInputType, sourceTimeZone);
        let diffMs = other.getTime() - baseDate.getTime();
        if (include_end) diffMs += diffMs >= 0 ? 86400_000 : -86400_000;
        const startParts = getZonedParts(baseDate, outputTimeZone);
        const endParts = getZonedParts(other, outputTimeZone);
        return json({
          operation,
          start: {
            utcIso: baseDate.toISOString(),
            local: formatDateInTimeZone(baseDate, outputTimeZone),
            parts: startParts,
          },
          end: {
            utcIso: other.toISOString(),
            local: formatDateInTimeZone(other, outputTimeZone),
            parts: endParts,
          },
          includeEnd: include_end,
          duration: durationBreakdown(diffMs),
        });
      }

      throw new Error(`Unsupported date math operation: ${operation}`);
    }),
  }));

  tools.push(tool({
    name: "as_unit_conversion",
    description: "Convert between units and currencies precisely.",
    parameters: {
      operation: z.enum(["convert", "list_categories", "list_units"]).default("convert"),
      amount: z.number().default(0),
      from_unit: z.string().default(""),
      to_unit: z.string().default(""),
      category: z.enum(["auto", "area", "currency", "digital_storage", "energy", "fuel", "length", "mass", "power", "pressure", "speed", "temperature", "time", "torque", "volume", "cooking"]).default("auto"),
      query: z.string().default(""),
      round_digits: z.number().int().min(0).max(18).default(12),
    },
    implementation: safeTool("as_unit_conversion", async ({ operation, amount, from_unit, to_unit, category, query, round_digits }) => {
      if (operation === "list_categories") {
        return json({ categories: unitCategoryList });
      }
      if (operation === "list_units") {
        const categories = category === "auto" ? unitCategoryList : [category as UnitCategory];
        const filtered = categories.map((entry) => ({
          category: entry,
          units: listUnitsForCategory(entry).filter((unit) => {
            const needle = normalize(query as string);
            return !needle || normalize(`${unit.canonical} ${unit.aliases.join(" ")}`).includes(needle);
          }),
        })).filter((entry) => entry.units.length > 0);
        return json({ categories: filtered });
      }
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount)) throw new Error("amount must be a finite number.");
      const requestedCategory = category as UnitCategory | "auto";
      const resolvedCategory = requestedCategory !== "auto"
        ? requestedCategory
        : ((): UnitCategory => {
            for (const candidate of unitCategoryList.filter((entry) => entry !== "currency")) {
              if (candidate === "temperature" || candidate === "fuel") continue;
              if (candidate === "cooking") {
                if (resolveLinearUnit("cooking", from_unit as string) && resolveLinearUnit("cooking", to_unit as string)) return "cooking";
                continue;
              }
              if (resolveLinearUnit(candidate, from_unit as string) && resolveLinearUnit(candidate, to_unit as string)) return candidate;
            }
            const fromTemp = normalizeUnitKey(from_unit as string);
            const toTemp = normalizeUnitKey(to_unit as string);
            if (["c", "celsius", "f", "fahrenheit", "k", "kelvin", "rankine", "delisle", "newton", "reaumur", "réaumur", "romer", "rømer", "gas mark"].includes(fromTemp)
              && ["c", "celsius", "f", "fahrenheit", "k", "kelvin", "rankine", "delisle", "newton", "reaumur", "réaumur", "romer", "rømer", "gas mark"].includes(toTemp)) return "temperature";
            const fuelKeys = ["mpg", "mpg us", "mpg uk", "l/100km", "km/l", "mi/l"];
            if (fuelKeys.includes(normalizeUnitKey(from_unit as string)) && fuelKeys.includes(normalizeUnitKey(to_unit as string))) return "fuel";
            return "currency";
          })();
      let converted = 0;
      const response: Record<string, unknown> = {
        amount: numericAmount,
        fromUnit: from_unit,
        toUnit: to_unit,
        category: resolvedCategory,
      };
      if (resolvedCategory === "currency") {
        const rates = await getCurrencyRates(ctx);
        const fromCode = resolveCurrencyCode(from_unit as string, rates.rates);
        const toCode = resolveCurrencyCode(to_unit as string, rates.rates);
        if (!fromCode || !toCode) {
          throw new Error(`Unsupported currency code or name: ${!fromCode ? from_unit : to_unit}`);
        }
        converted = numericAmount / rates.rates[fromCode] * rates.rates[toCode];
        response.fromUnit = fromCode;
        response.toUnit = toCode;
        response.ratesSource = rates.source;
        response.ratesFetchedAt = rates.fetchedAt;
        response.ratesStale = rates.stale;
      } else if (resolvedCategory === "temperature") {
        converted = convertTemperature(numericAmount, from_unit as string, to_unit as string);
      } else if (resolvedCategory === "fuel") {
        converted = convertFuel(numericAmount, from_unit as string, to_unit as string);
      } else {
        const fromDefinition = resolveLinearUnit(resolvedCategory, from_unit as string);
        const toDefinition = resolveLinearUnit(resolvedCategory, to_unit as string);
        if (!fromDefinition || !toDefinition) {
          throw new Error(`Unsupported ${resolvedCategory} unit pair: ${from_unit} -> ${to_unit}`);
        }
        converted = convertLinearUnit(numericAmount, fromDefinition, toDefinition);
        response.fromCanonical = fromDefinition.canonical;
        response.toCanonical = toDefinition.canonical;
      }
      response.result = Number(converted.toFixed(round_digits as number));
      response.resultExact = converted;
      return json(response);
    }),
  }));
}
