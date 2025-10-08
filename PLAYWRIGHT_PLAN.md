# Playwright Setup Plan for Monorepo

## 🎯 Goals

1. **Traditional E2E Testing**: Test the full user flow of the meeting intelligence app
2. **AI Agent Verification**: Allow AI agents to "see" their work by capturing screenshots/videos of what they build
3. **Visual Regression**: Compare UI changes over time
4. **Component Testing**: Test individual React components in isolation

---

## 📁 Recommended Structure

```
chip-mono-mvp/
├── frontend/                      # Next.js app
├── supabase-backend/             # Backend logic
├── e2e/                          # 🆕 E2E tests (new directory)
│   ├── tests/
│   │   ├── upload.spec.ts        # Test file upload flow
│   │   ├── recordings.spec.ts    # Test recordings list
│   │   ├── intelligence.spec.ts  # Test intelligence viewer
│   │   └── ai-verify/            # Special tests for AI verification
│   │       ├── component-render.spec.ts
│   │       └── prototype-check.spec.ts
│   ├── fixtures/                 # Test data
│   │   └── sample-meeting.mp4
│   ├── screenshots/              # Visual regression baselines
│   ├── playwright.config.ts      # Playwright configuration
│   └── package.json              # E2E test dependencies
└── package.json                  # Root package.json with e2e workspace
```

**Why a separate `e2e/` directory?**

- Tests aren't tied to just frontend or backend
- Can test the full stack integration
- Cleaner separation of concerns
- Easier to run tests in CI/CD

---

## 🔧 How Playwright Typically Works in Monorepos

### 1. **Installation & Configuration**

```bash
# In the e2e directory
npm init playwright@latest
```

This creates:

- `playwright.config.ts` - Configuration for browsers, baseURL, etc.
- `tests/` - Test files
- `playwright-report/` - HTML reports with screenshots/videos

### 2. **Key Configuration Options**

```typescript
// e2e/playwright.config.ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Where your Next.js app runs
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry', // Capture trace on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test against multiple browsers
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],

  // Start your Next.js dev server before tests
  webServer: {
    command: 'npm run dev:frontend',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. **Test Example**

```typescript
// e2e/tests/upload.spec.ts
import { test, expect } from '@playwright/test';

test('user can upload a meeting recording', async ({ page }) => {
  await page.goto('/');

  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('fixtures/sample-meeting.mp4');

  // Wait for processing
  await expect(page.locator('[data-testid="recording-status"]')).toContainText(
    'processing',
    { timeout: 5000 }
  );

  // Take screenshot for verification
  await page.screenshot({
    path: 'screenshots/upload-success.png',
    fullPage: true,
  });
});
```

---

## 🤖 Using Playwright for AI Agent Verification

This is where it gets interesting! Here's how Playwright can help AI agents "see" their work:

### Approach 1: **Visual Verification Mode**

```typescript
// e2e/tests/ai-verify/component-render.spec.ts
import { test, expect } from '@playwright/test';

test.describe('AI Prototype Verification', () => {
  test('capture full page state', async ({ page }) => {
    await page.goto('/');

    // Capture multiple views
    const screenshots = {
      desktop: await page.screenshot({ fullPage: true }),
      mobile: await page
        .setViewportSize({ width: 375, height: 812 })
        .then(() => page.screenshot({ fullPage: true })),
    };

    // Save to a location AI can access
    await saveForAI(screenshots);
  });

  test('verify component exists and is interactive', async ({ page }) => {
    await page.goto('/');

    // Check that components AI built are actually on page
    const fileUpload = page.locator('[data-testid="file-upload"]');
    await expect(fileUpload).toBeVisible();

    // Verify it's interactive
    await fileUpload.click();
    await expect(page.locator('.dropzone')).toBeVisible();

    // Return structured data for AI
    const verification = {
      componentPresent: true,
      isInteractive: true,
      screenshot: await page.screenshot(),
    };

    console.log(JSON.stringify(verification, null, 2));
  });
});
```

### Approach 2: **Accessibility Tree Analysis**

```typescript
test('analyze component structure for AI', async ({ page }) => {
  await page.goto('/');

  // Get accessibility tree (semantic structure)
  const snapshot = await page.accessibility.snapshot();

  // AI can understand the page structure without visual parsing
  console.log(JSON.stringify(snapshot, null, 2));

  // This gives AI:
  // - All interactive elements
  // - Their labels and roles
  // - Hierarchical structure
  // - Current states
});
```

### Approach 3: **Live Preview Server**

```typescript
// Start a server that AI can query
test('expose live preview endpoint', async ({ page }) => {
  await page.goto('/');

  // AI makes request: POST /playwright/screenshot
  // Returns: Screenshot + accessibility tree + console logs

  const state = {
    screenshot: await page.screenshot(),
    accessibility: await page.accessibility.snapshot(),
    console: page.context().consoleMessages(),
    errors: page.context().errors(),
  };

  // Expose via HTTP endpoint or file system
});
```

---

## 📊 Typical Workflow

### For Traditional Testing:

```bash
# 1. Write test
# 2. Run test
npm run test:e2e

# 3. View results
npm run test:e2e:report

# 4. Debug failures
npm run test:e2e:debug
```

### For AI Agent Verification:

```bash
# Option A: One-shot verification
npm run ai:verify -- --component=FileUpload

# Option B: Watch mode (AI builds, Playwright auto-captures)
npm run ai:watch

# Option C: Generate visual report
npm run ai:screenshot -- --page=/
```

---

## 🎨 Visual Regression Testing

Playwright can compare screenshots automatically:

```typescript
test('button looks correct', async ({ page }) => {
  await page.goto('/');

  // First run: saves baseline
  // Subsequent runs: compares against baseline
  await expect(page.locator('.upload-button')).toHaveScreenshot(
    'upload-button.png'
  );

  // If pixels differ, test fails with visual diff
});
```

**For AI Agents:**

- AI builds component
- Playwright captures baseline
- AI iterates
- Playwright shows visual diff
- AI can see exactly what changed

---

## 🔄 Integration with Your Monorepo

### Root-level Scripts (package.json):

```json
{
  "scripts": {
    "test:e2e": "npm run test --workspace=e2e",
    "test:e2e:ui": "npm run test:ui --workspace=e2e",
    "test:e2e:debug": "npm run test:debug --workspace=e2e",
    "ai:verify": "npm run ai:verify --workspace=e2e",
    "ai:screenshot": "npm run screenshot --workspace=e2e"
  }
}
```

### CI/CD Integration:

```yaml
# .github/workflows/e2e-tests.yml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: e2e/playwright-report/
```

---

## 🚀 AI Agent Benefits

### What AI Gets:

1. **Visual Feedback**
   - Screenshots of every page state
   - Visual diffs when making changes
   - Video recordings of user flows

2. **Structural Understanding**
   - Accessibility tree (semantic HTML structure)
   - All interactive elements
   - Current page state

3. **Error Detection**
   - Console errors
   - Network failures
   - Broken interactions

4. **Verification**
   - "Did my component render?"
   - "Is it interactive?"
   - "Does it match the design?"

### Example AI Workflow:

```
1. AI: "I'm going to add a delete button to recordings"
2. AI: Modifies RecordingsList.tsx
3. AI: Runs `npm run ai:verify`
4. Playwright:
   - Loads page
   - Takes screenshot
   - Checks button exists
   - Verifies it's clickable
   - Returns JSON + image
5. AI: Sees the button rendered correctly ✅
```

---

## 📦 Recommended Packages

```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0",
    "playwright-core": "^1.40.0"
  }
}
```

Optional enhancements:

- `@axe-core/playwright` - Accessibility testing
- `playwright-lighthouse` - Performance testing
- `expect-playwright` - Additional matchers

---

## 🎯 Next Steps

1. **Create `e2e/` directory** with basic structure
2. **Install Playwright** with `npm init playwright@latest`
3. **Write first test** - Upload flow
4. **Add AI verification scripts** - Screenshot + accessibility snapshot
5. **Integrate with CI/CD** - Run on PRs
6. **Create AI helper functions** - Make it easy for agents to verify work

---

## 💡 Pro Tips

- **Use data-testid attributes** for reliable selectors (AI and tests)
- **Start server automatically** via webServer config
- **Parallel execution** speeds up test runs
- **Trace viewer** is amazing for debugging (`npx playwright show-trace`)
- **Codegen** can generate tests by recording actions (`npx playwright codegen`)

---

## Questions to Consider:

1. **Where should screenshots be saved?** (Git? S3? Local only?)
2. **How should AI trigger tests?** (CLI? HTTP endpoint? File watcher?)
3. **What level of visual regression?** (Strict pixel matching or flexible?)
4. **Test data strategy?** (Use real sample recordings or mocks?)
5. **How to handle OpenAI API calls in tests?** (Mock or use real API?)

---

Would you like me to proceed with setting up any of these components?
