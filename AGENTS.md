# Agent Instructions

## Project Overview

This is a code reviewer application built with TypeScript and Vite.

## Development Workflow

- Use `pnpm` as the package manager
- TypeScript for all code

## Available Resources

### Effect Repository Reference

The Effect library repository is cloned and available at `.context/effect/` for reference purposes only. Use this to search for best practices, patterns, and examples when implementing features with Effect. The Git history is preserved, so you can search commits and branches for additional context.

**Important**: Only read from this directory. Do not modify any files in `.context/effect/`.

### Documentation Resources

- **NPM Libraries Documentation**: Use Context7 to fetch up-to-date documentation and code examples for any npm library (except Effect - see above)
- **Effect Documentation**: Search directly in `.context/effect/` folder for Effect-specific patterns and examples
- **Browser Debugging**: Use Chrome DevTools MCP to debug and analyze browser behavior when needed

## Project Structure

- `src/` - Source code
  - `adapters/` - Adapter implementations (diff-parser, storage, vcs)
  - `lib/` - Shared utilities and types
- `vite.config.ts` - Vite configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
