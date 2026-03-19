const { performance } = require('perf_hooks');

const PREFIX_H_REGEX = /^#+\s/;
const PREFIX_TASK_REGEX = /^\s*[-*]\s\[[ xX]\]\s/;
const PREFIX_UL_REGEX = /^\s*[-*]\s/;
const PREFIX_OL_REGEX = /^\s*\d+\.\s/;
const PREFIX_BQ_REGEX = /^\s*>\s/;

function processLineHoisted(line) {
  return line
    .replace(PREFIX_H_REGEX, "")
    .replace(PREFIX_TASK_REGEX, "")
    .replace(PREFIX_UL_REGEX, "")
    .replace(PREFIX_OL_REGEX, "")
    .replace(PREFIX_BQ_REGEX, "");
}

function processLineInline(line) {
  return line
    .replace(/^#+\s/, "")
    .replace(/^\s*[-*]\s\[[ xX]\]\s/, "")
    .replace(/^\s*[-*]\s/, "")
    .replace(/^\s*\d+\.\s/, "")
    .replace(/^\s*>\s/, "");
}

const lines = [
  "# Heading 1",
  "## Heading 2",
  "- [ ] Task item",
  "- List item",
  "1. Ordered item",
  "> Blockquote",
  "Regular text line that is somewhat long but doesn't match any of the prefixes. ".repeat(5),
];

const iterations = 500000;

function runBenchmark(fn, name) {
    // Warm up
    for (let i = 0; i < 10000; i++) lines.forEach(fn);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        lines.forEach(fn);
    }
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(4)}ms`);
    return end - start;
}

console.log("Running line regex benchmark...");
const inlineTime = runBenchmark(processLineInline, "Inline Regex");
const hoistedTime = runBenchmark(processLineHoisted, "Hoisted Regex");

const improvement = ((inlineTime - hoistedTime) / inlineTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
