# tests/e2e/ — reserved for browser end-to-end tests

None exist yet. This repo has no Playwright/Puppeteer/browser
automation; all current gates are stub-DOM Node scripts in ../node/.
If a real-browser test is ever added, it belongs here and must be
kept out of the default npm test suite unless it can run headless
in CI.
