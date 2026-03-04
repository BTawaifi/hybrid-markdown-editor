const assert = require('assert');

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

const testStrings = [
    "Simple text",
    "**bold** text",
    "text **bold**",
    "**bold** **bold**",
    "**bold** with *some* other things",
    "Empty **",
    "**** empty bold",
    "**bold** and **more bold** and some **other**",
    "no bold here"
];

testStrings.forEach(text => {
    const inlineResult = parseBoldInline(text);
    const hoistedResult = parseBoldHoisted(text);
    try {
        assert.deepStrictEqual(inlineResult, hoistedResult);
        console.log(`PASS: "${text}"`);
    } catch (err) {
        console.error(`FAIL: "${text}"`);
        console.error("Inline:", JSON.stringify(inlineResult));
        console.error("Hoisted:", JSON.stringify(hoistedResult));
        process.exit(1);
    }
});

console.log("All tests passed!");
