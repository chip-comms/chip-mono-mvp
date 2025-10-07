# GitHub Actions Workflows

## Lint and Format Check (`lint-pr.yml`)

This workflow automatically runs on every pull request to ensure code quality and consistency.

### What it does:

1. **Detects Changed Files**: Only checks files that were modified in the PR (not the entire codebase)
2. **Prettier Check**: Validates that all changed `.ts`, `.tsx`, `.js`, `.jsx` files are properly formatted
3. **ESLint**: Runs linting rules on changed files in the frontend directory
4. **PR Comments**: Automatically comments on the PR if checks fail

### Triggers:

- Pull requests to `main` or `develop` branches
- Only runs when files in `frontend/`, `supabase-backend/`, or the workflow itself change

### Local Development:

Before pushing your PR, you can run these checks locally:

#### Frontend:
```bash
cd frontend
npm run lint          # Check for linting errors
npm run format:check  # Check formatting
npm run format        # Auto-fix formatting
```

#### Backend:
```bash
cd supabase-backend
npm run format:check  # Check formatting
npm run format        # Auto-fix formatting
```

#### Root-level (all files):
```bash
prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"  # Check formatting
prettier --write "**/*.{ts,tsx,js,jsx,json,css,md}"  # Auto-fix formatting
```

### Benefits:

- ⚡ **Fast**: Only checks changed files, not the entire codebase
- 🎯 **Focused**: Provides feedback only on code you modified
- 🔄 **Consistent**: Ensures all team members follow the same code style
- 💬 **Helpful**: Provides clear feedback when checks fail

