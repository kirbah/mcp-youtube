# AGENTS.md

This file provides instructions for AI coding agents on how to work with this project.

## Project Philosophy

1.  **Token Efficiency is Paramount:** Every tool and data structure is designed to be "lean" and "token-optimized." When modifying code, prioritize returning only the most essential data to minimize the token footprint for the client LLM. Avoid verbose responses.
2.  **LLM-Centric Design:** Data should be structured for easy consumption by AI models. This means clear, predictable JSON structures and concise field names.
3.  **Robustness and Reliability:** All new code should include strong input validation (using Zod schemas) and clear, consistent error handling.

## Key Commands

| Command             | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `npm install`       | Installs all project dependencies. Run this first.                          |
| `npm run lint`      | Checks the code for linting errors according to ESLint rules.               |
| `npm run format`    | Automatically formats all code using Prettier.                              |
| `npm run test`      | Executes the entire Jest test suite. All tests must pass before committing. |
| `npm run build`     | Compiles the TypeScript project into JavaScript in the `/dist` directory.   |
| `npm run inspector` | Runs the MCP server with a local inspector for debugging tools.             |

## Project Architecture

- **Entry Point**: `src/index.ts` initializes the environment, the service container, and the MCP server. It registers all tools.
- **Dependency Injection**: `src/container.ts` manages singleton instances of core services. When you need access to a service within a tool handler, it is injected via `src/tools/index.ts`.
- **Services (`src/services/`)**:
  - `YoutubeService`: The main interface to the YouTube Data API. Contains all logic for fetching and transforming data. **Most modifications to data fetching will happen here.**
  - `CacheService`: Provides a caching layer over MongoDB to reduce API calls and quota usage. The `YoutubeService` uses this extensively.
  - `TranscriptService`: Handles fetching and parsing video transcripts.
- **Tools (`src/tools/`)**: Each tool is defined in its own file and has three parts: a Zod schema for input validation, a configuration object (`...Config`), and a handler function (`...Handler`).
- **Tool Registration**: `src/tools/index.ts` is the central registry. All new tools must be added to the `allTools` array here to be exposed by the server.

## Common Tasks

### How to Add a New Tool

1.  **Create the Tool File**: Add a new `.ts` file in the appropriate subdirectory of `src/tools/` (e.g., `src/tools/video/newTool.ts`).
2.  **Define Input Schema**: In the new file, define a `zod` schema for the tool's input parameters.
3.  **Define Tool Configuration**: Export a `...Config` object containing the tool's `name`, `description`, and `inputSchema`.
4.  **Implement the Handler**: Export an async `...Handler` function that accepts `params` and any required services (e.g., `youtubeService`). Implement the tool's logic and return the result using `formatSuccess` or `formatError`.
5.  **Register the Tool**: In `src/tools/index.ts`, import the new `config` and `handler`, and add them to the `toolDefinitions` array, injecting the necessary services.

### How to Modify an Existing Tool

1.  **Locate the Tool File**: Find the tool's definition in the `src/tools/` directory.
2.  **Update Schema (if needed)**: If changing the tool's inputs, update the Zod schema in the tool's file.
3.  **Modify Handler Logic**: Update the `...Handler` function with the new logic.
4.  **Modify Service Layer (if needed)**: If the change requires different data from the YouTube API, update the corresponding method in `src/services/youtube.service.ts`.
5.  **Update Tests**: Locate the relevant test file (e.g., `src/services/__tests__/youtube.service.test.ts`) and add or update tests to cover your changes.

## Dev Environment

- Use the `install_nvm.sh` script to set up the correct Node.js version.
- Run `npm install` to install dependencies.
- Create a `.env` file from `.env.example` and provide a valid `YOUTUBE_API_KEY` and `MDB_MCP_CONNECTION_STRING`.

## Testing Instructions

- Run all tests with `npm run test`.
- To run tests for a single file (which is faster during development), use: `npm run test -- <path_to_test_file>`.
  - Example: `npm run test -- src/services/__tests__/youtube.service.test.ts`
- Tests are written with Jest. Mocks for external services are heavily used. When modifying a service method, ensure you also check its corresponding mock in the test files.
- Always add or update tests to reflect your code changes.

## Commit Message and PR Guidelines

- **Commit Messages**: Use the Conventional Commits format.
  - `feat(tool): Add getChannelComments tool`
  - `fix(youtube): Correctly handle null view counts`
  - `docs(agents): Update instructions for adding a tool`
  - `refactor(cache): Improve cache key generation`
- **Pull Requests**:
  - Title format should be clear and concise.
  - Before submitting, ensure you have run `npm run lint` and `npm run test` and that all checks pass.

## Security & API Quota Considerations

- **API Keys**: Never hardcode the `YOUTUBE_API_KEY` or any other secret in the source code. It is loaded exclusively from environment variables. Do not log the API key.
- **API Quota**: The YouTube Data API has a daily quota. Be mindful of the cost of API calls.
  - **Expensive Tools**: The `searchVideos` and `getChannelTopVideos` tools are very expensive (100+ quota units per call).
  - **Cheap Tools**: Most other tools like `getVideoDetails` or `getChannelStatistics` are cheap (1 quota unit per call).
  - When modifying the `YoutubeService`, avoid making unnecessary API calls. Leverage the `CacheService` whenever possible.
