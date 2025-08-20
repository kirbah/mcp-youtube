# AGENTS.md

This file provides instructions for AI coding agents on how to work with this project.

## Project Overview

This is a TypeScript project that provides a high-efficiency YouTube MCP (Model Context Protocol) server. It serves token-optimized, structured data for LLMs using the YouTube Data API v3.

## Project Architecture

- **Core Structure**: The application is built around a Model Context Protocol (MCP) server.
- **Dependency Management**: It utilizes a dependency injection pattern, managed through `src/container.ts`. This container initializes and provides instances of key services such as `CacheService`, `YoutubeService`, and `TranscriptService`.
- **Entry Point**: The main application entry point is `src/index.ts`. This file is responsible for:
    - Initializing the service container.
    - Creating and configuring the MCP server.
    - Registering all available tools (defined in `src/tools/index.ts`) with the server.
    - Establishing communication via `StdioServerTransport` (standard input/output).
- **External Integrations**: The project primarily interacts with the YouTube Data API v3. It also uses MongoDB for caching and persistent data storage.
- **Configuration**: Critical configurations, such as the `YOUTUBE_API_KEY`, are managed via environment variables.

## Dev Environment

- Use `install_nvm.sh` to set up the correct Node.js version.
- Run `npm install` to install dependencies.
- The project uses TypeScript. Run `npm run build` to compile the code into JavaScript in the `dist` directory.

## Testing Instructions

- **Framework**: Tests are written using Jest and TypeScript.
- **Execution**: Run `npm run test` to execute the entire Jest test suite.
- **Location**: Test files are typically located in `__tests__` directories, mirroring the directory structure of the source code (e.g., `src/services/__tests__/youtube/`).
- **Conventions**:
    - **Mocking**: Extensive use of `jest.mock` is employed to isolate units under test. This includes mocking external dependencies (like `googleapis`) and internal services.
    - **Setup/Teardown**: `beforeEach` hooks are commonly used to set up a clean test environment and reset mocks before each test.
    - **Assertions**: Tests cover various scenarios, including successful operations, edge cases (e.g., empty inputs, malformed data), and robust error handling.
    - **Utility Testing**: Utility functions (e.g., `formatSuccess`, `formatError`) are also mocked and their interactions are asserted.
- **Coverage**: Test coverage reports are generated in the `coverage` directory. A JUnit XML report is also generated in the `test-results` directory.
- **Best Practices**: Ensure all tests pass before committing changes. When adding new features or fixing bugs, please include corresponding tests to maintain code quality and prevent regressions.

## Code Style

- This project uses ESLint for linting and Prettier for code formatting.
- Run `npm run lint` to check for linting errors.
- Run `npm run format` to automatically format the code.
- Please ensure that your changes adhere to the existing code style.