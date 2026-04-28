// Global test setup for Vitest (jsdom environment)
// Runs before every test file in tests/unit/

// Provide a simple localStorage mock (jsdom includes one, but we reset it here)
beforeEach(() => {
  localStorage.clear();
});
