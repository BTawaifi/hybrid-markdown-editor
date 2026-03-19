const { performance } = require('perf_hooks');

const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i}`);
const idxToChange = 5000;
const newValue = "Changed Line 5000";

function handleLineChangeSlow() {
    return lines.map((l, i) => (i === idxToChange ? newValue : l)).join("\n");
}

function handleLineChangeFast() {
    const nextLines = [...lines];
    nextLines[idxToChange] = newValue;
    return nextLines.join("\n");
}

const iterations = 5000;

function runBenchmark(fn, name) {
    // Warm up
    for (let i = 0; i < 100; i++) fn();

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(4)}ms`);
    return end - start;
}

console.log("Running benchmark...");
const slowTime = runBenchmark(handleLineChangeSlow, "Slow (map then join)");
const fastTime = runBenchmark(handleLineChangeFast, "Fast (array copy then join)");

const improvement = ((slowTime - fastTime) / slowTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
