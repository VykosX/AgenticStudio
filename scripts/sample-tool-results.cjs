const { collectSampleResults } = require("./tool-result-samples.cjs");

async function main() {
  const results = await collectSampleResults();
  for (const sample of results) {
    console.log(`\n=== ${sample.id} (${sample.bytes} bytes) ===`);
    console.log(sample.resultText);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
