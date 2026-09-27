# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-27

### Added
- **`tern doctor`**: Comprehensive diagnostic scanner reporting project health percentage, Node.js version, package manager lockfiles, git status, package.json validity, missing env variables, port conflicts, and deployment configs.
- **`tern fix`**: Interactive auto-remediation for safe issues (adding `.env` to `.gitignore`, cleaning conflicting lockfiles, installing missing dependencies, initializing `.env` from template) with `--yes` flag support for CI environments.
- **`tern env`**: Secure environment variable inspector comparing `.env` against `.env.example` without ever exposing secret values.
- **`tern port <number>`**: Cross-platform active process detector and killer for development ports.
- **`tern clean`**: Cache and build artifact cleaner (`dist`, `.next`, `.turbo`, `node_modules/.cache`, etc.) with disk space reclaim calculation and `--all` flag.
- **`tern deps`**: Dependency health analyzer checking outdated packages, security advisories, and wildcard versions.
- **`tern git`**: Git repository health checker detecting uncommitted changes, unpushed commits, and scanning for leaked API keys, tokens, and private keys.
- **`tern deploy`**: Production deployment readiness checker verifying build scripts, platform configs (`vercel.json`, `netlify.toml`, `Dockerfile`), production `.env` tracking, and hardcoded `localhost` URLs.
- **`tern report`**: Diagnostic markdown report generator ready to paste into GitHub Issues or save to disk.
- Optional configuration file `.ternrc.json` support.
- Fully typed TypeScript architecture, bundled with `tsup` for ESM + CJS, tested with Vitest and linted with ESLint.
