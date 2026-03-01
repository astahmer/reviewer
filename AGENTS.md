# Agent Instructions

## Project Overview

This is a code reviewer application built with TypeScript and Vite.

## Development Workflow

- Use `pnpm` as the package manager
- TypeScript for all code

## Available Resources

### Context Repositories Reference

Multiple repository clones are available in the `.context/` directory for reference purposes only. These include:

- `.context/effect/`
- `.context/ark-ui/`
- `.context/tanstack-router/`
- `.context/opencode/`
- `.context/pierre/`

Use these directories to search for best practices, patterns, examples, and implementation references. The Git history is preserved in each repository, so you can search commits and branches for additional context.

**Important**: Only read from these directories. Do not modify any files in `.context/`.

### Documentation Resources

- **NPM Libraries Documentation**: Use Context7 to fetch up-to-date documentation and code examples for any npm library
- **Repository References**: Search directly in the appropriate `.context/` folder for library-specific patterns and examples
- **Browser Debugging**: Use Chrome DevTools MCP to debug and analyze browser behavior when needed

## Project Structure

- `src/` - Source code
  - `adapters/` - Adapter implementations (diff-parser, storage, vcs)
  - `lib/` - Shared utilities and types
- `vite.config.ts` - Vite configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
