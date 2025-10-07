# Development Commands

This is a monorepo with workspace support. You can run commands from the root directory or within individual packages.

## 🚀 Quick Start

### Initial Setup

```bash
# Install all dependencies (root + workspaces)
npm install

# Or manually install each workspace
npm run install:all
```

## 📝 Formatting & Linting (Root Level)

Run these commands from the **root directory** to check/fix all files:

### Format All Files

```bash
npm run format              # Auto-fix formatting in all files
npm run format:check        # Check formatting without fixing
```

### Format Specific Workspace

```bash
npm run format:frontend     # Format frontend only
npm run format:backend      # Format backend only
```

### Lint

```bash
npm run lint               # Lint ALL workspaces (frontend + backend)
npm run lint:frontend      # Lint frontend only
npm run lint:backend       # Lint backend only
```

## 🔧 Development Commands

### Frontend

```bash
npm run dev:frontend       # Start frontend dev server
npm run build:frontend     # Build frontend for production

# Or cd into frontend directory
cd frontend
npm run dev
npm run build
npm run lint
npm run format
```

### Backend

```bash
cd supabase-backend
npm run format
npm run format:check
```

## 💡 Tips

1. **Before committing**: Run `npm run format` and `npm run lint` from root
2. **CI/CD**: GitHub Actions will automatically check formatting and linting on PRs
3. **VS Code**: Install Prettier extension for automatic formatting on save
4. **Performance**: Root commands use globs, so they're fast even with many files

## 🎯 Recommended Workflow

```bash
# 1. Make your changes
# 2. Format all files
npm run format

# 3. Check linting
npm run lint

# 4. Commit and push
git add .
git commit -m "Your message"
git push
```

The GitHub Actions workflow will automatically verify formatting and linting on your PR! ✨
