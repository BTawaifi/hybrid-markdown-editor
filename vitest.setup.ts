import '@testing-library/jest-dom/vitest';

// Mock scrollIntoView which is not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = function() {};
