# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development**: `npm run dev` - Runs the main script (`src/getTargetOrderData.ts`)
- **Type checking**: `npm run ts-check` or `npm run tsc` - TypeScript compilation check without emitting files
- **Linting**: `npm run lint` - ESLint with TypeScript support
- **Formatting**: `npm run prettier` - Format code, `npm run prettier-check` - Check formatting
- **Quality checks**: `npm run signal` - Runs TypeScript check, linting, and prettier check in parallel (USE THIS BEFORE COMMITTING)
- **Testing**: `npm run test` - Run Jest tests in `src/` directory
- **Authentication**: `npm run login` - Run Playwright tests for authentication setup

## Architecture Overview

This is a Target order data extraction tool that uses Playwright for web scraping and API data retrieval.

### Core Components

**Main Entry Point**:
- `src/getTargetOrderData.ts` - CLI application entry point using Commander.js with options for order count, date ranges, and invoice data fetching

**API & Data Handling**:
- `src/TargetAPIData.ts` - Core API interaction functions for fetching order history, invoice data, and aggregations
- `src/TargetAPITypes.ts` - Comprehensive Zod schemas for Target API response validation and TypeScript types
- `src/processAPIData.ts` - CLI tool for processing and manipulating collected data with pruning, slicing, and validation options

**Browser Automation**:
- `src/Setup.ts` - Playwright browser setup with stealth plugin configuration
- `src/Auth.ts` - Authentication state management and cookie validation for Target.com
- `src/ActionQueue.ts` - Queue system for managing browser actions with rate limiting

**Utilities**:
- `src/CustomRateLimiter.ts` - API request rate limiting to avoid overwhelming Target's servers
- `src/DateUtils.ts` - Date parsing and manipulation utilities
- `src/Files.ts` - File I/O operations for JSON data persistence
- `src/Helpers.ts` - General helper functions and utilities
- `src/Constants.ts` - Application constants including Target URLs

### Key Features

- **CLI Interface**: Uses `@commander-js/extra-typings` for type-safe command-line argument parsing
- **Data Validation**: Comprehensive Zod schemas ensure API response integrity
- **Authentication**: Persistent authentication state using Playwright's storage system
- **Rate Limiting**: Custom rate limiter prevents API abuse
- **Data Processing**: Supports data pruning, validation, and category extraction
- **Output Management**: Automatic file naming with timestamps and size tracking

### Technology Stack

- **Runtime**: Node.js >=20.11.0 with ES modules
- **Browser Automation**: Playwright with stealth plugin for anti-detection
- **Type Safety**: TypeScript with strict configuration
- **Schema Validation**: Zod for runtime type checking
- **Testing**: Jest with ts-jest transformer
- **Code Quality**: ESLint + Prettier with pre-commit hooks via Husky

### File Structure Pattern

- Flat source structure in `src/` - no nested directories or barrel files
- Each module has a single responsibility (API, Auth, Utils, etc.)
- Types are defined alongside their usage or in dedicated type files
- Test files are co-located with source files using `.test.ts` suffix

## Development Notes

- The codebase requires Node.js >=20.11.0 for `import.meta.dirname` support
- Authentication state is stored in `playwright/.auth/user-2.json`
- Uses stealth plugin to avoid detection during web scraping
- Rate limiting is implemented to be respectful of Target's API limits
- All API responses are validated with Zod schemas for type safety