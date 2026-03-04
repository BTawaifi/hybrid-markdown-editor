const { performance } = require('perf_hooks');

const BOLD_REGEX_HOISTED = /(\*\*[^*]+\*\*)/g;

function parseBoldHoisted(text) {
  const parts = text.split(BOLD_REGEX_HOISTED);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { type: 'strong', content: part.slice(2, -2) };
    }
    return part;
  });
}

function parseBoldInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { type: 'strong', content: part.slice(2, -2) };
    }
    return part;
  });
}

const text = "This is a **bold** text and another **one** here. " + "some other text ".repeat(10) + " **more bold** ".repeat(5);

const iterations = 1000000;

function runBenchmark(fn, name) {
    // Warm up
    for (let i = 0; i < 10000; i++) fn(text);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn(text);
    }
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(4)}ms`);
    return end - start;
}

console.log("Running benchmark...");
const inlineTime = runBenchmark(parseBoldInline, "Inline Regex");
const hoistedTime = runBenchmark(parseBoldHoisted, "Hoisted Regex");

const improvement = ((inlineTime - hoistedTime) / inlineTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
