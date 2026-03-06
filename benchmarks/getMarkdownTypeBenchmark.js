const { performance } = require('perf_hooks');

const H1_REGEX = /^#{1}\s/;
const H2_REGEX = /^#{2}\s/;
const H3_REGEX = /^#{3}\s/;
const H4_REGEX = /^#{4}\s/;
const LI_TASK_REGEX = /^\s*[-*]\s\[[ xX]\]\s/;
const LI_UL_REGEX = /^\s*[-*]\s/;
const LI_OL_REGEX = /^\s*\d+\.\s/;
const BLOCKQUOTE_REGEX = /^\s*>\s/;

const getMarkdownTypeHoisted = (line) => {
  if (H1_REGEX.test(line)) return "h1";
  if (H2_REGEX.test(line)) return "h2";
  if (H3_REGEX.test(line)) return "h3";
  if (H4_REGEX.test(line)) return "h4";
  if(LI_TASK_REGEX.test(line)) return "li";
  if(LI_UL_REGEX.test(line)) return "li";
  if(LI_OL_REGEX.test(line)) return "li";
  if(BLOCKQUOTE_REGEX.test(line)) return "blockquote";
  return "p";
};

const getMarkdownTypeInline = (line) => {
  if (/^#{1}\s/.test(line)) return "h1";
  if (/^#{2}\s/.test(line)) return "h2";
  if (/^#{3}\s/.test(line)) return "h3";
  if (/^#{4}\s/.test(line)) return "h4";
  if(/^\s*[-*]\s\[[ xX]\]\s/.test(line)) return "li";
  if(/^\s*[-*]\s/.test(line)) return "li";
  if(/^\s*\d+\.\s/.test(line)) return "li";
  if(/^\s*>\s/.test(line)) return "blockquote";
  return "p";
};

const lines = [
  "# Heading 1",
  "## Heading 2",
  "### Heading 3",
  "#### Heading 4",
  "- [ ] Task item",
  "- Bullet item",
  "1. Numbered item",
  "> Blockquote",
  "Regular paragraph text",
  "   - Indented bullet",
  "   1. Indented number",
  "  > Indented quote"
];

const iterations = 1000000;

function runBenchmark(fn, name) {
    // Warm up
    for (let i = 0; i < 10000; i++) {
        for (const line of lines) fn(line);
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        for (const line of lines) fn(line);
    }
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(4)}ms`);
    return end - start;
}

console.log("Running benchmark...");
const inlineTime = runBenchmark(getMarkdownTypeInline, "Inline Regex");
const hoistedTime = runBenchmark(getMarkdownTypeHoisted, "Hoisted Regex");

const improvement = ((inlineTime - hoistedTime) / inlineTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
