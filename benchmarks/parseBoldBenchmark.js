const { performance } = require('perf_hooks');

const BOLD_TOKEN_REGEX = /\*\*([^*]+)\*\*/g;

function tokenizeBold(text) {
  const tokens = [];
  let cursor = 0;
  BOLD_TOKEN_REGEX.lastIndex = 0;
  let match;
  while ((match = BOLD_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > cursor) tokens.push(['text', text.slice(cursor, match.index)]);
    tokens.push(['bold', match[1]]);
    cursor = BOLD_TOKEN_REGEX.lastIndex;
  }
  if (cursor < text.length || tokens.length === 0) tokens.push(['text', text.slice(cursor)]);
  return tokens;
}

const text = "This is a **bold** text and another **one** here. " +
  "some other text ".repeat(10) + " **more bold** ".repeat(5) + " **literal";
const iterations = 500000;

for (let i = 0; i < 10000; i += 1) tokenizeBold(text);
const start = performance.now();
for (let i = 0; i < iterations; i += 1) tokenizeBold(text);
const end = performance.now();

console.log(`Tokenizer: ${(end - start).toFixed(4)}ms for ${iterations} iterations`);
