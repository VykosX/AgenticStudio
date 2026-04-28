"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mathConstantDocs = exports.mathFunctionDocs = void 0;
exports.getMathToolReference = getMathToolReference;
exports.getUnitConversionToolReference = getUnitConversionToolReference;
exports.registerMathAndUnitTools = registerMathAndUnitTools;
// @ts-nocheck
const path = __importStar(require("path"));
const mathjs_1 = require("mathjs");
const mathEngine = (0, mathjs_1.create)(mathjs_1.all, {
    number: "BigNumber",
    precision: 64,
});
function mathStateFilePathFromDirectory(baseDirectory) {
    return path.join(baseDirectory, "math-scope.json");
}
function normalizeUnitKey(value) {
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
function preprocessMathExpression(expression) {
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
        if (!trimmed)
            return trimmed;
        const letAssignment = trimmed.match(/^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
        if (letAssignment)
            return `${letAssignment[1]} = ${letAssignment[2]}`;
        const walrusAssignment = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*(.+)$/);
        if (walrusAssignment)
            return `${walrusAssignment[1]} = ${walrusAssignment[2]}`;
        const reversedAssignment = trimmed.match(/^(.+?)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)$/);
        if (reversedAssignment && !/^[A-Za-z_][A-Za-z0-9_]*(\s*\([^)]*\))?$/.test(reversedAssignment[1].trim())) {
            return `${reversedAssignment[2]} = ${reversedAssignment[1].trim()}`;
        }
        return trimmed;
    })
        .join("; ");
}
function getMathFunctionDefinitions(angleUnit) {
    const toRadians = (value) => angleUnit === "degrees"
        ? mathEngine.multiply(value, mathEngine.divide(mathEngine.pi, 180))
        : value;
    const fromRadians = (value) => angleUnit === "degrees"
        ? mathEngine.multiply(value, mathEngine.divide(180, mathEngine.pi))
        : value;
    const numeric = (value) => Number(mathEngine.number(value));
    const asBigNumber = (value) => mathEngine.bignumber(String(value));
    const flatten = (args) => args.flatMap((item) => Array.isArray(item) ? flatten(item) : [item]);
    const gamma = (value) => {
        const numericValue = numeric(value);
        return Number.isInteger(numericValue) ? mathEngine.gamma(value) : mathEngine.gamma(numericValue);
    };
    const factorial = (value) => mathEngine.factorial(value);
    const combinations = (n, k) => mathEngine.combinations(n, k);
    const permutations = (n, k) => mathEngine.permutations(n, k);
    const binomialPmf = (k, n, p) => {
        const kk = numeric(k);
        const nn = numeric(n);
        const pp = numeric(p);
        if (!Number.isInteger(kk) || !Number.isInteger(nn) || kk < 0 || nn < 0 || kk > nn)
            return asBigNumber(0);
        return asBigNumber(Number(combinations(nn, kk)) * (pp ** kk) * ((1 - pp) ** (nn - kk)));
    };
    const poissonPmf = (k, lambda) => {
        const kk = numeric(k);
        const ll = numeric(lambda);
        if (!Number.isInteger(kk) || kk < 0 || ll < 0)
            return asBigNumber(0);
        return asBigNumber((ll ** kk) * Math.exp(-ll) / Number(factorial(kk)));
    };
    const hyperPmf = (k, population, successStates, draws) => {
        const kk = numeric(k);
        const nn = numeric(population);
        const mm = numeric(successStates);
        const dd = numeric(draws);
        if (![kk, nn, mm, dd].every(Number.isFinite))
            return asBigNumber(0);
        return asBigNumber((Number(combinations(mm, kk)) * Number(combinations(nn - mm, dd - kk))) / Number(combinations(nn, dd)));
    };
    return {
        abs: (x) => mathEngine.abs(x),
        sqrt: (x) => mathEngine.sqrt(x),
        cbrt: (x) => mathEngine.cbrt(x),
        exp: (x) => mathEngine.exp(x),
        ln: (x) => mathEngine.log(x),
        log: (x) => mathEngine.log10(x),
        lg: (x) => mathEngine.log10(x),
        lb: (x) => mathEngine.log2(x),
        logn: (base, x) => mathEngine.divide(mathEngine.log(x), mathEngine.log(base)),
        int: (x) => mathEngine.fix(x),
        frac: (x) => mathEngine.subtract(x, mathEngine.fix(x)),
        trunc: (x) => mathEngine.fix(x),
        round: (x, decimals) => decimals === undefined ? mathEngine.round(x) : mathEngine.round(x, decimals),
        ceil: (x) => mathEngine.ceil(x),
        floor: (x) => mathEngine.floor(x),
        sin: (x) => mathEngine.sin(toRadians(x)),
        cos: (x) => mathEngine.cos(toRadians(x)),
        tan: (x) => mathEngine.tan(toRadians(x)),
        asin: (x) => fromRadians(mathEngine.asin(x)),
        acos: (x) => fromRadians(mathEngine.acos(x)),
        atan: (x) => fromRadians(mathEngine.atan(x)),
        atan2: (y, x) => fromRadians(mathEngine.atan2(y, x)),
        sinh: (x) => mathEngine.sinh(x),
        cosh: (x) => mathEngine.cosh(x),
        tanh: (x) => mathEngine.tanh(x),
        asinh: (x) => mathEngine.asinh(x),
        acosh: (x) => mathEngine.acosh(x),
        atanh: (x) => mathEngine.atanh(x),
        radians: (x) => mathEngine.multiply(x, mathEngine.divide(mathEngine.pi, 180)),
        degrees: (x) => mathEngine.multiply(x, mathEngine.divide(180, mathEngine.pi)),
        real: (x) => mathEngine.re(x),
        imag: (x) => mathEngine.im(x),
        phase: (x) => fromRadians(mathEngine.arg(x)),
        polar: (x) => mathEngine.complex({ r: mathEngine.abs(x), phi: mathEngine.arg(x) }),
        cart: (x) => mathEngine.complex(x),
        average: (...args) => mathEngine.mean(flatten(args)),
        mean: (...args) => mathEngine.mean(flatten(args)),
        geomean: (...args) => mathEngine.geometricMean(flatten(args)),
        median: (...args) => mathEngine.median(flatten(args)),
        min: (...args) => mathEngine.min(...flatten(args)),
        max: (...args) => mathEngine.max(...flatten(args)),
        sum: (...args) => mathEngine.sum(...flatten(args)),
        product: (...args) => mathEngine.prod(flatten(args)),
        variance: (...args) => mathEngine.variance(flatten(args)),
        stddev: (...args) => mathEngine.std(flatten(args)),
        gcd: (...args) => flatten(args).reduce((acc, value) => mathEngine.gcd(acc, value)),
        lcm: (...args) => flatten(args).reduce((acc, value) => mathEngine.lcm(acc, value)),
        mod: (x, y) => mathEngine.mod(x, y),
        idiv: (x, y) => mathEngine.floor(mathEngine.divide(x, y)),
        and: (x, y) => mathEngine.bitAnd(x, y),
        or: (x, y) => mathEngine.bitOr(x, y),
        xor: (x, y) => mathEngine.bitXor(x, y),
        not: (x) => mathEngine.bitNot(x),
        shl: (x, bits) => mathEngine.leftShift(x, bits),
        shr: (x, bits) => mathEngine.rightArithShift(x, bits),
        ncr: (n, r) => combinations(n, r),
        npr: (n, r) => permutations(n, r),
        gamma: (x) => gamma(x),
        gammafn: (x) => gamma(x),
        lngamma: (x) => mathEngine.log(mathEngine.abs(gamma(x))),
        erf: (x) => asBigNumber(mathEngine.erf(numeric(x))),
        erfc: (x) => asBigNumber(mathEngine.erfc(numeric(x))),
        bin: (x) => `0b${mathEngine.number(x).toString(2)}`,
        oct: (x) => `0o${mathEngine.number(x).toString(8)}`,
        hex: (x) => `0x${mathEngine.number(x).toString(16)}`,
        dec: (x) => `${mathEngine.number(x)}`,
        binompmf: (k, n, p) => binomialPmf(k, n, p),
        binomcdf: (k, n, p) => {
            let total = asBigNumber(0);
            for (let i = 0; i <= numeric(k); i++)
                total = mathEngine.add(total, binomialPmf(i, n, p));
            return total;
        },
        binommean: (n, p) => asBigNumber(numeric(n) * numeric(p)),
        binomvar: (n, p) => asBigNumber(numeric(n) * numeric(p) * (1 - numeric(p))),
        poipmf: (k, lambda) => poissonPmf(k, lambda),
        poicdf: (k, lambda) => {
            let total = asBigNumber(0);
            for (let i = 0; i <= numeric(k); i++)
                total = mathEngine.add(total, poissonPmf(i, lambda));
            return total;
        },
        poimean: (lambda) => asBigNumber(numeric(lambda)),
        poivar: (lambda) => asBigNumber(numeric(lambda)),
        hyperpmf: (k, population, successStates, draws) => hyperPmf(k, population, successStates, draws),
        hypercdf: (k, population, successStates, draws) => {
            let total = asBigNumber(0);
            for (let i = 0; i <= numeric(k); i++)
                total = mathEngine.add(total, hyperPmf(i, population, successStates, draws));
            return total;
        },
        hypermean: (population, successStates, draws) => asBigNumber((numeric(draws) * numeric(successStates)) / numeric(population)),
        hypervar: (population, successStates, draws) => {
            const N = numeric(population);
            const K = numeric(successStates);
            const n = numeric(draws);
            return asBigNumber(n * (K / N) * (1 - K / N) * ((N - n) / (N - 1)));
        },
    };
}
exports.mathFunctionDocs = [
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
exports.mathConstantDocs = [
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
const digitalStorageUnits = [
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
const areaUnits = [
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
const lengthUnits = [
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
const massUnits = [
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
const energyUnits = [
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
const powerUnits = [
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
const pressureUnits = [
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
const speedUnits = [
    { canonical: "m/s", factor: 1, aliases: ["m/s", "meter/second", "meters/second", "metre/second", "metres/second"] },
    { canonical: "km/h", factor: 1000 / 3600, aliases: ["km/h", "kph", "kilometer/hour", "kilometers/hour", "kilometre/hour", "kilometres/hour"] },
    { canonical: "mph", factor: 1609.344 / 3600, aliases: ["mph", "mile/hour", "miles/hour"] },
    { canonical: "ft/s", factor: 0.3048, aliases: ["ft/s", "foot/second", "feet/second"] },
    { canonical: "knot", factor: 1852 / 3600, aliases: ["knot", "knots", "kt", "kts"] },
];
const timeUnits = [
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
const torqueUnits = [
    { canonical: "N*m", factor: 1, aliases: ["n m", "n*m", "nm torque", "newton meter", "newton meters"] },
    { canonical: "ft*lbf", factor: 1.3558179483314004, aliases: ["ft-lbf", "ft lbf", "foot pound-force", "foot pounds-force"] },
    { canonical: "in*lbf", factor: 0.1129848290276167, aliases: ["in-lbf", "in lbf", "inch pound-force", "inch pounds-force"] },
];
const volumeUnits = [
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
const linearUnitCategoryDefinitions = {
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
function buildUnitAliasLookup(entries) {
    const map = new Map();
    for (const entry of entries) {
        map.set(normalizeUnitKey(entry.canonical), entry);
        for (const alias of entry.aliases) {
            map.set(normalizeUnitKey(alias), entry);
        }
    }
    return map;
}
const unitAliasLookups = Object.fromEntries(Object.entries({ ...linearUnitCategoryDefinitions, cooking: cookingUnits }).map(([category, entries]) => [category, buildUnitAliasLookup(entries)]));
function getMathToolReference(includeDetailedValues = false) {
    return {
        overview: "Evaluate expressions, persist definitions, reuse ans/last, and inspect built-in functions and constants.",
        functions: exports.mathFunctionDocs.map((entry) => includeDetailedValues ? entry : { name: entry.name, summary: entry.summary, example: entry.example }),
        constants: exports.mathConstantDocs.map((entry) => includeDetailedValues
            ? entry
            : { name: entry.name, summary: entry.summary, aliases: entry.aliases || [] }),
        notes: [
            "Use mode=evaluate for expressions and assignments.",
            "Use mode=list_functions or mode=list_constants for tool-native discovery.",
            "ans and last reference the previous result in the current conversation scope.",
        ],
    };
}
function getUnitConversionToolReference(includeDetailedValues = false) {
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
        unitsByCategory: Object.fromEntries(Object.entries({ ...linearUnitCategoryDefinitions, cooking: cookingUnits }).map(([category, entries]) => [
            category,
            entries.map((entry) => includeDetailedValues
                ? { canonical: entry.canonical, factor: entry.factor, aliases: entry.aliases }
                : { canonical: entry.canonical, aliases: entry.aliases }),
        ])),
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
function dateMathLocalTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
function assertValidTimeZone(timeZone) {
    const value = String(timeZone || "").trim() || dateMathLocalTimeZone();
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
        return value;
    }
    catch {
        throw new Error(`Invalid IANA timezone: ${value}`);
    }
}
function parseIsoLikeLocalDateTime(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?)?$/);
    if (!match)
        return null;
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
function getZonedParts(date, timeZone) {
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
function getTimeZoneOffsetMs(date, timeZone) {
    const parts = getZonedParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, date.getUTCMilliseconds());
    return asUtc - date.getTime();
}
function zonedPartsToUtc(parts, timeZone) {
    let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, parts.millisecond || 0);
    for (let i = 0; i < 4; i++) {
        const offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
        const next = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, parts.millisecond || 0) - offset;
        if (next === utcMs)
            break;
        utcMs = next;
    }
    return new Date(utcMs);
}
function parseDateValue(value, inputType, timeZone) {
    const raw = String(value || "").trim();
    if (!raw && inputType !== "auto")
        throw new Error("date is required.");
    const type = inputType === "auto"
        ? (/^-?\d+(\.\d+)?$/.test(raw)
            ? (Math.abs(Number(raw)) > 10_000_000_000 ? "unix_milliseconds" : "unix_seconds")
            : "iso")
        : inputType;
    let date;
    if (type === "unix_seconds")
        date = new Date(Number(raw) * 1000);
    else if (type === "unix_milliseconds")
        date = new Date(Number(raw));
    else if (type === "excel_serial")
        date = new Date(excelEpochMs + Number(raw) * 86400_000);
    else if (type === "julian_day")
        date = new Date((Number(raw) - julianUnixEpoch) * 86400_000);
    else {
        const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
        if (hasExplicitZone) {
            date = new Date(raw);
        }
        else {
            const localParts = parseIsoLikeLocalDateTime(raw);
            date = localParts ? zonedPartsToUtc(localParts, timeZone) : new Date(raw);
        }
    }
    if (Number.isNaN(date.getTime()))
        throw new Error(`Invalid date value: ${value}`);
    return date;
}
function parseYearInput(value, inputType) {
    const raw = String(value || "").trim();
    if (!raw)
        return null;
    if (inputType !== "auto" && inputType !== "iso")
        return null;
    if (!/^-?\d{1,6}$/.test(raw))
        return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
}
function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function dayOfYear(parts) {
    const start = Date.UTC(parts.year, 0, 1);
    const current = Date.UTC(parts.year, parts.month - 1, parts.day);
    return Math.floor((current - start) / 86400_000) + 1;
}
function isoWeek(parts) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const isoWeekYear = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoWeekYear, 0, 1));
    const isoWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400_000) + 1) / 7);
    return { isoWeekYear, isoWeek, isoWeekday: day };
}
function parseDurationJson(raw, fallbackUnit, amount) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) {
        const key = String(fallbackUnit || "days").toLowerCase();
        return { [key]: Number(amount || 0) };
    }
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("duration_json must be a JSON object.");
    const duration = {};
    for (const [key, value] of Object.entries(parsed)) {
        const normalized = key.toLowerCase();
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue))
            throw new Error(`Invalid duration value for ${key}.`);
        if (["year", "years"].includes(normalized))
            duration.years = numberValue;
        else if (["month", "months"].includes(normalized))
            duration.months = numberValue;
        else if (["week", "weeks"].includes(normalized))
            duration.weeks = numberValue;
        else if (["day", "days"].includes(normalized))
            duration.days = numberValue;
        else if (["hour", "hours"].includes(normalized))
            duration.hours = numberValue;
        else if (["minute", "minutes"].includes(normalized))
            duration.minutes = numberValue;
        else if (["second", "seconds"].includes(normalized))
            duration.seconds = numberValue;
        else if (["millisecond", "milliseconds", "ms"].includes(normalized))
            duration.milliseconds = numberValue;
        else
            throw new Error(`Unsupported duration unit: ${key}`);
    }
    return duration;
}
function addDuration(date, duration, timeZone) {
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
function formatDateInTimeZone(date, timeZone) {
    const parts = getZonedParts(date, timeZone);
    const offsetMs = getTimeZoneOffsetMs(date, timeZone);
    const sign = offsetMs >= 0 ? "+" : "-";
    const absolute = Math.abs(offsetMs);
    const offsetHours = Math.floor(absolute / 3600_000);
    const offsetMinutes = Math.floor((absolute % 3600_000) / 60_000);
    return `${padNumber(parts.year, 4)}-${padNumber(parts.month, 2)}-${padNumber(parts.day, 2)}T${padNumber(parts.hour, 2)}:${padNumber(parts.minute, 2)}:${padNumber(parts.second, 2)}.${padNumber(parts.millisecond, 3)}${sign}${padNumber(offsetHours, 2)}:${padNumber(offsetMinutes, 2)}`;
}
function padNumber(value, width) {
    return String(Math.trunc(value)).padStart(width, "0");
}
function formatDateOutput(date, outputType, timeZone) {
    const parts = getZonedParts(date, timeZone);
    if (outputType === "iso")
        return date.toISOString();
    if (outputType === "local")
        return formatDateInTimeZone(date, timeZone);
    if (outputType === "unix_seconds")
        return date.getTime() / 1000;
    if (outputType === "unix_milliseconds")
        return date.getTime();
    if (outputType === "excel_serial")
        return (date.getTime() - excelEpochMs) / 86400_000;
    if (outputType === "julian_day")
        return date.getTime() / 86400_000 + julianUnixEpoch;
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
function durationBreakdown(ms) {
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
async function readPersistedMathScope(ctx, statePath) {
    return ctx.readJsonFile(statePath, { lastResultText: "0", definitions: [] });
}
async function writePersistedMathScope(ctx, statePath, scope) {
    await ctx.writeJsonFile(statePath, scope);
}
function extractMathDefinitions(expression) {
    const definitions = [];
    const statements = preprocessMathExpression(expression).split(/[\n;]+/).map((line) => line.trim()).filter(Boolean);
    for (const statement of statements) {
        const match = statement.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*\([^)]*\))?\s*=/);
        if (!match)
            continue;
        definitions.push({ key: match[1], statement });
    }
    return definitions;
}
function createMathParser(angleUnit) {
    const parser = mathEngine.parser();
    const definitions = getMathFunctionDefinitions(angleUnit);
    for (const [name, fn] of Object.entries(definitions)) {
        parser.set(name, fn);
    }
    for (const doc of exports.mathConstantDocs) {
        try {
            const value = mathEngine.evaluate(doc.valueExpression);
            parser.set(doc.name, value);
            for (const alias of doc.aliases || []) {
                parser.set(alias, value);
            }
        }
        catch {
            // Keep the parser usable even if a constant definition is malformed.
        }
    }
    return parser;
}
function formatMathResult(value, precision = 24) {
    return mathEngine.format(value, { precision, lowerExp: -12, upperExp: 20 });
}
function classifyMathResult(value) {
    if (mathEngine.isUnit?.(value))
        return "unit";
    if (mathEngine.isComplex?.(value))
        return "complex";
    if (mathEngine.isBigNumber?.(value))
        return "big-number";
    if (typeof value === "number")
        return "number";
    if (typeof value === "string")
        return "string";
    if (typeof value === "boolean")
        return "boolean";
    if (Array.isArray(value))
        return "array";
    return typeof value;
}
function resolveLinearUnit(category, rawUnit) {
    const lookup = unitAliasLookups[category];
    if (!lookup)
        return null;
    return lookup.get(normalizeUnitKey(rawUnit)) || null;
}
function convertTemperature(amount, fromUnitRaw, toUnitRaw) {
    const fromUnit = normalizeUnitKey(fromUnitRaw);
    const toUnit = normalizeUnitKey(toUnitRaw);
    const toCelsius = (value, unit) => {
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
    const fromCelsius = (value, unit) => {
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
function convertFuel(amount, fromUnitRaw, toUnitRaw) {
    const normalizeFuel = (unit) => normalizeUnitKey(unit)
        .replace(/miles per gallon/gi, "mpg")
        .replace(/miles\/gallon/gi, "mpg")
        .replace(/kilometers per litre/gi, "km/l")
        .replace(/kilometres per litre/gi, "km/l")
        .replace(/miles per litre/gi, "mi/l")
        .replace(/litres per 100 ?km/gi, "l/100km")
        .replace(/liters per 100 ?km/gi, "l/100km");
    const fromUnit = normalizeFuel(fromUnitRaw);
    const toUnit = normalizeFuel(toUnitRaw);
    const toKmPerL = (value, unit) => {
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
    const fromKmPerL = (value, unit) => {
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
function convertLinearUnit(amount, fromUnit, toUnit) {
    return (amount * fromUnit.factor) / toUnit.factor;
}
async function getCurrencyRates(ctx, forceRefresh = false) {
    const cachePath = path.join(ctx.pluginDataDirectory(), "currency", "rates.json");
    const cached = await ctx.readJsonFile(cachePath, null);
    const cacheAgeMs = cached?.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY;
    if (!forceRefresh && cached?.rates && cacheAgeMs < 3600_000) {
        return { ...cached, stale: false };
    }
    try {
        const response = await fetch("https://api.frankfurter.app/latest?from=USD");
        if (!response.ok)
            throw new Error(`Currency rate request failed with ${response.status}`);
        const payload = await response.json();
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
    }
    catch (error) {
        if (cached?.rates) {
            return { ...cached, stale: true };
        }
        throw error;
    }
}
function resolveCurrencyCode(input, rates) {
    const normalized = normalizeUnitKey(input).replace(/\s+/g, " ");
    const codes = Array.from(new Set([...Object.keys(rates), ...currencyNameFallbacks])).sort();
    const displayNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
        ? new Intl.DisplayNames(["en"], { type: "currency" })
        : null;
    for (const code of codes) {
        if (normalized === code.toLowerCase())
            return code;
        const display = displayNames?.of(code);
        if (display && normalizeUnitKey(display) === normalized)
            return code;
    }
    return null;
}
const unitCategoryList = ["area", "currency", "digital_storage", "energy", "fuel", "length", "mass", "power", "pressure", "speed", "temperature", "time", "torque", "volume", "cooking"];
function listUnitsForCategory(category) {
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
    const entries = category === "cooking" ? cookingUnits : linearUnitCategoryDefinitions[category];
    return (entries || []).map((entry) => ({ canonical: entry.canonical, aliases: entry.aliases }));
}
function registerMathAndUnitTools(ctx, tools) {
    const { tool, z, safeTool, workspaceRoot, fsp, json, normalize, getConversationStorageContext } = ctx;
    async function resolveMathStatePath(root) {
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
                const filtered = exports.mathFunctionDocs.filter((entry) => {
                    const needle = normalize(query);
                    return !needle || normalize(`${entry.name} ${entry.summary} ${entry.example || ""}`).includes(needle);
                });
                return json({
                    count: filtered.length,
                    note: "Query only the functions you need.",
                    functions: filtered.map((entry) => detailed ? entry : { name: entry.name, summary: entry.summary }),
                });
            }
            if (mode === "list_constants") {
                const filtered = exports.mathConstantDocs.filter((entry) => {
                    const needle = normalize(query);
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
            const parser = createMathParser(angle_unit);
            const statePath = await resolveMathStatePath(workspaceRoot);
            const persisted = await readPersistedMathScope(ctx, statePath);
            for (const definition of persisted.definitions || []) {
                try {
                    parser.evaluate(definition.statement);
                }
                catch { }
            }
            if (persisted.lastResultText) {
                try {
                    const ansValue = mathEngine.evaluate(persisted.lastResultText);
                    parser.set("ans", ansValue);
                    parser.set("last", ansValue);
                }
                catch {
                    parser.set("ans", 0);
                    parser.set("last", 0);
                }
            }
            else {
                parser.set("ans", 0);
                parser.set("last", 0);
            }
            const preparedExpression = preprocessMathExpression(expression);
            if (!preparedExpression.trim()) {
                throw new Error("expression is required when mode=evaluate.");
            }
            const result = parser.evaluate(preparedExpression);
            const resultText = formatMathResult(result);
            const nextDefinitions = [...(persisted.definitions || [])];
            for (const definition of extractMathDefinitions(preparedExpression)) {
                const existingIndex = nextDefinitions.findIndex((entry) => entry.key === definition.key);
                if (existingIndex >= 0)
                    nextDefinitions.splice(existingIndex, 1);
                nextDefinitions.push(definition);
            }
            await writePersistedMathScope(ctx, statePath, {
                lastResultText: resultText,
                definitions: nextDefinitions,
            });
            const response = {
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
                const zones = typeof Intl.supportedValuesOf === "function"
                    ? Intl.supportedValuesOf("timeZone")
                    : ["UTC", dateMathLocalTimeZone(), "America/New_York", "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney"];
                const needle = normalize(query);
                const filtered = zones.filter((zone) => !needle || normalize(zone).includes(needle));
                return json({ count: filtered.length, timeZones: filtered.slice(0, 500) });
            }
            if (operation === "is_leap_year") {
                const explicitYear = parseYearInput(date, input_type);
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
                : parseDateValue(date, input_type, sourceTimeZone);
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
                    result: operation === "weekday" ? baseInfo.weekday : formatDateOutput(baseDate, output_type, outputTimeZone),
                });
            }
            if (operation === "convert") {
                return json({
                    operation,
                    ...baseInfo,
                    outputType: output_type,
                    result: formatDateOutput(baseDate, output_type, outputTimeZone),
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
                const duration = parseDurationJson(duration_json, unit, amount);
                const resultDate = addDuration(baseDate, duration, sourceTimeZone);
                return json({
                    operation,
                    source: baseInfo,
                    duration,
                    outputType: output_type,
                    result: formatDateOutput(resultDate, output_type, outputTimeZone),
                    resultInfo: {
                        utcIso: resultDate.toISOString(),
                        local: formatDateInTimeZone(resultDate, outputTimeZone),
                        parts: getZonedParts(resultDate, outputTimeZone),
                    },
                });
            }
            if (operation === "diff" || operation === "range") {
                const other = parseDateValue(end_date, input_type, sourceTimeZone);
                let diffMs = other.getTime() - baseDate.getTime();
                if (include_end)
                    diffMs += diffMs >= 0 ? 86400_000 : -86400_000;
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
                const categories = category === "auto" ? unitCategoryList : [category];
                const filtered = categories.map((entry) => ({
                    category: entry,
                    units: listUnitsForCategory(entry).filter((unit) => {
                        const needle = normalize(query);
                        return !needle || normalize(`${unit.canonical} ${unit.aliases.join(" ")}`).includes(needle);
                    }),
                })).filter((entry) => entry.units.length > 0);
                return json({ categories: filtered });
            }
            const numericAmount = Number(amount);
            if (!Number.isFinite(numericAmount))
                throw new Error("amount must be a finite number.");
            const requestedCategory = category;
            const resolvedCategory = requestedCategory !== "auto"
                ? requestedCategory
                : (() => {
                    for (const candidate of unitCategoryList.filter((entry) => entry !== "currency")) {
                        if (candidate === "temperature" || candidate === "fuel")
                            continue;
                        if (candidate === "cooking") {
                            if (resolveLinearUnit("cooking", from_unit) && resolveLinearUnit("cooking", to_unit))
                                return "cooking";
                            continue;
                        }
                        if (resolveLinearUnit(candidate, from_unit) && resolveLinearUnit(candidate, to_unit))
                            return candidate;
                    }
                    const fromTemp = normalizeUnitKey(from_unit);
                    const toTemp = normalizeUnitKey(to_unit);
                    if (["c", "celsius", "f", "fahrenheit", "k", "kelvin", "rankine", "delisle", "newton", "reaumur", "réaumur", "romer", "rømer", "gas mark"].includes(fromTemp)
                        && ["c", "celsius", "f", "fahrenheit", "k", "kelvin", "rankine", "delisle", "newton", "reaumur", "réaumur", "romer", "rømer", "gas mark"].includes(toTemp))
                        return "temperature";
                    const fuelKeys = ["mpg", "mpg us", "mpg uk", "l/100km", "km/l", "mi/l"];
                    if (fuelKeys.includes(normalizeUnitKey(from_unit)) && fuelKeys.includes(normalizeUnitKey(to_unit)))
                        return "fuel";
                    return "currency";
                })();
            let converted = 0;
            const response = {
                amount: numericAmount,
                fromUnit: from_unit,
                toUnit: to_unit,
                category: resolvedCategory,
            };
            if (resolvedCategory === "currency") {
                const rates = await getCurrencyRates(ctx);
                const fromCode = resolveCurrencyCode(from_unit, rates.rates);
                const toCode = resolveCurrencyCode(to_unit, rates.rates);
                if (!fromCode || !toCode) {
                    throw new Error(`Unsupported currency code or name: ${!fromCode ? from_unit : to_unit}`);
                }
                converted = numericAmount / rates.rates[fromCode] * rates.rates[toCode];
                response.fromUnit = fromCode;
                response.toUnit = toCode;
                response.ratesSource = rates.source;
                response.ratesFetchedAt = rates.fetchedAt;
                response.ratesStale = rates.stale;
            }
            else if (resolvedCategory === "temperature") {
                converted = convertTemperature(numericAmount, from_unit, to_unit);
            }
            else if (resolvedCategory === "fuel") {
                converted = convertFuel(numericAmount, from_unit, to_unit);
            }
            else {
                const fromDefinition = resolveLinearUnit(resolvedCategory, from_unit);
                const toDefinition = resolveLinearUnit(resolvedCategory, to_unit);
                if (!fromDefinition || !toDefinition) {
                    throw new Error(`Unsupported ${resolvedCategory} unit pair: ${from_unit} -> ${to_unit}`);
                }
                converted = convertLinearUnit(numericAmount, fromDefinition, toDefinition);
                response.fromCanonical = fromDefinition.canonical;
                response.toCanonical = toDefinition.canonical;
            }
            response.result = Number(converted.toFixed(round_digits));
            response.resultExact = converted;
            return json(response);
        }),
    }));
}
//# sourceMappingURL=mathAndUnits.js.map