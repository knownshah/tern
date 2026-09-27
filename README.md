# Tern 🩺

<p align="center">
  <strong>One command to diagnose your development environment.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tern-cli"><img src="https://img.shields.io/npm/v/tern-cli.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/tern-tools/tern/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/tern-tools/tern/ci.yml?branch=main&style=flat-square&label=CI" alt="Build Status" /></a>
  <a href="https://github.com/tern-tools/tern/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square" alt="Node.js Version" /></a>
</p>

---

**Tern** is an open-source, production-ready developer environment doctor. It analyzes your project configuration, dependencies, environment variables, git repository, ports, and deployment setups to pinpoint misconfigurations and provide instant automated fixes.

```
Tern v0.1.0
Scanning project...

✓ Node.js 20.11.0 (satisfies >=18.0.0)
✓ Git repository detected (branch: main)
⚠ 3 outdated dependencies
✗ Missing environment variable: DATABASE_URL
✗ .env accidentally tracked by Git

Project Health: [████████████████░░░░] 78% (Good)
Run `tern fix` to resolve safe issues automatically.
```

---

## ⚡ Quick Start

Run instantly in any Node.js/JS/TS project without installing:

```bash
npx tern doctor
```

Or install globally:

```bash
# Using pnpm
pnpm add -g tern-cli

# Using npm
npm install -g tern-cli

# Using yarn
yarn global add tern-cli
```

---

## 🚀 Commands

| Command | Description |
| :--- | :--- |
| [`tern doctor`](#1-tern-doctor) | Scan project health, diagnose lockfiles, env vars, ports, and configs. |
| [`tern fix`](#2-tern-fix) | Automatically repair safe issues (missing `.env`, duplicate lockfiles, `.gitignore`). |
| [`tern env`](#3-tern-env) | Compare `.env` vs `.env.example` **without ever leaking secret values**. |
| [`tern port <number>`](#4-tern-port-number) | Find processes occupying a port across macOS, Linux, and Windows, with kill option. |
| [`tern clean`](#5-tern-clean) | Reclaim disk space by clearing build folders and caches (`dist`, `.next`, `.turbo`, etc.). |
| [`tern deps`](#6-tern-deps) | Inspect outdated packages and run security vulnerability audits. |
| [`tern git`](#7-tern-git) | Check uncommitted/unpushed changes and scan for leaked API keys or credentials. |
| [`tern deploy`](#8-tern-deploy) | Validate deployment readiness (platform configs, build script, hardcoded localhost URLs). |
| [`tern report`](#9-tern-report) | Generate a comprehensive Markdown report ready to paste into GitHub Issues. |

---

### 1. `tern doctor`

Diagnoses your entire developer environment in seconds:
- **Node.js runtime**: Checks your active Node version against `engines.node`, `.nvmrc`, or `.node-version`.
- **Package Manager & Lockfiles**: Detects active package manager (pnpm, npm, yarn, bun) and warns on conflicting duplicate lockfiles.
- **Git Repository**: Checks if Git is initialized, branch state, and uncommitted modifications.
- **`package.json`**: Validates JSON syntax, essential metadata, build/dev scripts, and whether `node_modules` is installed.
- **Environment Variables**: Compares `.env.example` against `.env` and flags missing keys.
- **Security Check**: Verifies that `.env` files are ignored in `.gitignore` and not committed to Git.
- **Port Conflicts**: Inspects common development ports (3000, 5173, 8080, etc.) for existing zombie processes.
- **Deployment**: Checks for Dockerfile, Vercel, Netlify, or Fly.io configurations.

```bash
# Standard check
npx tern doctor

# Fail on warnings (exit code 1)
npx tern doctor --strict

# Output machine-readable JSON for CI pipelines
npx tern doctor --json
```

### 2. `tern fix`

Applies automated repairs to safe-to-fix problems with interactive confirmation:
- Creates missing `.env` from `.env.example` with placeholder keys.
- Appends missing required keys into existing `.env` files.
- Adds `.env` ignore rules to `.gitignore`.
- Removes accidentally committed `.env` files from Git index (`git rm --cached`).
- Deletes redundant duplicate lockfiles.
- Runs package manager install if `node_modules` is missing.

```bash
# Interactive mode (asks confirmation before applying changes)
npx tern fix

# Non-interactive mode (ideal for CI/CD)
npx tern fix --yes
```

### 3. `tern env`

Deep inspection of environment configuration. **Never exposes secret values**:

```bash
# Compare .env with .env.example
npx tern env

# Automatically append missing placeholder keys to your local .env
npx tern env --sync

# Custom paths
npx tern env --example .env.template --env .env.local
```

### 4. `tern port <number>`

Cross-platform active port inspector (macOS, Linux, Windows):

```bash
# Check if port 3000 is occupied
npx tern port 3000

# Terminate process with confirmation
npx tern port 3000 --kill

# Force terminate without confirmation
npx tern port 3000 --kill --force --yes
```

### 5. `tern clean`

Clears build artifacts and caches (`node_modules/.cache`, `dist`, `build`, `.next`, `.turbo`, `.nuxt`, `coverage`, etc.):

```bash
# Inspect and delete caches with confirmation
npx tern clean

# Dry run: calculate reclaimable disk space without deleting
npx tern clean --dry-run

# Skip confirmation
npx tern clean --yes

# Also include node_modules
npx tern clean --all
```

### 6. `tern deps`

Analyzes project dependencies:

```bash
# Inspect outdated dependencies and audit vulnerabilities
npx tern deps

# Attempt automated vulnerability fixes
npx tern deps --fix
```

### 7. `tern git`

Examines Git health and scans working tree & commits for leaked credentials:

```bash
# Run Git diagnostics and secret scan
npx tern git
```

*Patterns scanned include AWS keys, GitHub tokens, Slack tokens, Stripe keys, Private Key blocks, and Google API keys (values are redacted in output).*

### 8. `tern deploy`

Pre-flight checklist before deploying to production:

```bash
npx tern deploy
```
- Ensures `.env.production` is never committed to Git.
- Scans source code for hardcoded `http://localhost:` or `http://127.0.0.1:` URLs.
- Validates Dockerfile / `vercel.json` / `netlify.toml` syntax.
- Verifies `build` script presence in `package.json`.

### 9. `tern report`

Generates a GitHub-flavored Markdown diagnostic report ready to share:

```bash
# Print report to terminal
npx tern report

# Save report directly to file
npx tern report -o tern-report.md
```

---

## ⚙️ Configuration (`.ternrc.json`)

You can customize Tern's behavior by placing a `.ternrc.json` in your project root:

```json
{
  "ignoreChecks": [
    "port-conflicts"
  ],
  "ports": [3000, 5173, 8080],
  "minNodeVersion": ">=18.0.0",
  "cleanPaths": [
    "dist",
    ".next",
    ".cache"
  ],
  "strict": false
}
```

---

## 🔒 Security & Privacy

Tern is designed from the ground up with a strict security-first philosophy:
- **Zero Secret Exposure**: Environment values are never printed, stored, or sent anywhere. Tern only handles variable names/keys.
- **Leak Detection**: Tracks and prevents secrets from being accidentally pushed to Git.
- **Local Execution**: All diagnostic logic runs 100% locally on your machine.

---

## 🛠️ CI / CD Integration

Use Tern in GitHub Actions to prevent bad merges or misconfigured PRs:

```yaml
name: Environment Doctor

on: [push, pull_request]

jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx tern doctor --strict
```

---

## 🤝 Contributing

Contributions are warmly welcome!

1. Fork the repository
2. Clone your fork: `git clone https://github.com/tern-tools/tern.git`
3. Install dependencies: `pnpm install`
4. Run tests: `pnpm test`
5. Create a branch: `git checkout -b feature/my-new-check`
6. Commit changes: `git commit -m "feat: add ruby check"`
7. Push and open a Pull Request!

---

## 📄 License

[MIT](LICENSE) © 2026 Tern Authors
