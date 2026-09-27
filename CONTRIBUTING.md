# Contributing to Tern 🩺

Thank you for your interest in contributing to Tern!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/terngg/tern.git
   cd tern
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run local development CLI:**
   ```bash
   pnpm dev doctor
   pnpm dev agent
   ```

## Quality Standards

Before submitting a Pull Request, please ensure all checks pass:

```bash
# Typecheck
pnpm typecheck

# Code formatting
pnpm format:check

# Linter
pnpm lint

# Unit and regression tests
pnpm test

# Build
pnpm build
```

## Adding New Diagnostics or Rules

- Diagnostic checks live in `src/checks/`.
- AI Coding agent scanner lives in `src/agent/`.
- MCP server scanner lives in `src/mcp/`.
- Local error rules for `tern why` live in `src/why/rules.ts`.

All contributions must respect privacy: **never print or log secrets, API keys, or credentials**.
