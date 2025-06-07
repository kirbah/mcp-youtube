# YouTube Data MCP Server (@kirbah/mcp-youtube)

<!-- Badges Start -->
<p align="left">
  <!-- GitHub Actions CI -->
  <a href="https://github.com/kirbah/mcp-youtube/actions/workflows/ci.yml">
    <img src="https://github.com/kirbah/mcp-youtube/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <!-- Codecov -->
  <a href="https://codecov.io/gh/kirbah/mcp-youtube">
    <img src="https://codecov.io/gh/kirbah/mcp-youtube/branch/main/graph/badge.svg?token=Y6B2E0T82P" alt="Code Coverage"/>
  </a>
  <!-- NPM Version -->
  <a href="https://www.npmjs.com/package/@kirbah/mcp-youtube">
    <img src="https://img.shields.io/npm/v/@kirbah/mcp-youtube.svg" alt="NPM Version" />
  </a>
  <!-- License -->
  <a href="https://github.com/kirbah/mcp-youtube/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/@kirbah/mcp-youtube.svg" alt="License" />
  </a>
  <!-- NPM Downloads -->
  <a href="https://www.npmjs.com/package/@kirbah/mcp-youtube">
    <img src="https://img.shields.io/npm/dt/@kirbah/mcp-youtube.svg" alt="NPM Downloads" />
  </a>
  <!-- Node Version -->
  <a href="package.json">
    <img src="https://img.shields.io/node/v/@kirbah/mcp-youtube.svg" alt="Node.js Version Support" />
  </a>
</p>
<!-- Badges End -->

**High-efficiency YouTube MCP server: Get token-optimized, structured data for your LLMs using the YouTube Data API v3.**

This Model Context Protocol (MCP) server empowers AI language models to seamlessly interact with YouTube. It's engineered to return **lean, structured data**, significantly **reducing token consumption** and making it ideal for cost-effective and performant LLM applications. Access a comprehensive suite of tools for video search, detail retrieval, transcript fetching, channel analysis, and trend discovery—all optimized for AI.

## Why `@kirbah/mcp-youtube`?

In the world of Large Language Models, every token counts. `@kirbah/mcp-youtube` is designed from the ground up with this principle in mind:

- 🚀 **Token Efficiency:** Get just the data you need, precisely structured to minimize overhead for your LLM prompts and responses.
- 🧠 **LLM-Centric Design:** Tools and data formats are tailored for easy integration and consumption by AI models.
- 📊 **Comprehensive YouTube Toolkit:** Access a wide array of YouTube functionalities, from video details and transcripts to channel statistics and trending content.
- 🛡️ **Robust & Reliable:** Built with strong input validation (Zod) and clear error handling.

## Key Features

- **Optimized Video Information:** Search videos with advanced filters. Retrieve detailed metadata, statistics (views, likes, etc.), and content details, all structured for minimal token footprint.
- **Efficient Transcript Management:** Fetch video captions/subtitles with multi-language support, perfect for content analysis by LLMs.
- **Insightful Channel Analysis:** Get concise channel statistics (subscribers, views, video count) and discover a channel's top-performing videos without data bloat.
- **Lean Trend Discovery:** Find trending videos by region and category, and get lists of available video categories, optimized for quick AI processing.
- **Structured for AI:** All responses are designed to be easily parsable and immediately useful for language models.

## Available Tools

The server provides the following MCP tools, each designed to return token-optimized data:

| Tool Name              | Description                                                                                                                                  | Parameters (see details in tool schema)                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `getVideoDetails`      | Retrieves detailed, **lean** information for multiple YouTube videos including metadata, statistics, engagement ratios, and content details. | `videoIds` (array of strings)                                                                                         |
| `searchVideos`         | Searches for videos or channels based on a query string with various filtering options, returning **concise** results.                       | `query` (string), `maxResults` (optional number), `order` (optional), `type` (optional), `channelId` (optional), etc. |
| `getTranscripts`       | Retrieves **token-efficient** transcripts (captions) for multiple videos.                                                                    | `videoIds` (array of strings), `lang` (optional string for language code)                                             |
| `getChannelStatistics` | Retrieves **lean** statistics for multiple channels (subscriber count, view count, video count, creation date).                              | `channelIds` (array of strings)                                                                                       |
| `getChannelTopVideos`  | Retrieves a list of a channel's top-performing videos with **lean** details and engagement ratios.                                           | `channelId` (string), `maxResults` (optional number)                                                                  |
| `getTrendingVideos`    | Retrieves a list of trending videos for a given region and optional category, with **lean** details and engagement ratios.                   | `regionCode` (optional string), `categoryId` (optional string), `maxResults` (optional number)                        |
| `getVideoCategories`   | Retrieves available YouTube video categories (ID and title) for a specific region, providing **essential data only**.                        | `regionCode` (optional string)                                                                                        |

_For detailed input parameters and their descriptions, please refer to the `inputSchema` within each tool's configuration file in the `src/tools/` directory (e.g., `src/tools/video/getVideoDetails.ts`)._

## Getting Started

### Prerequisites

- Node.js (version specified in `package.json` engines field - currently `>=20.0.0`)
- npm (usually comes with Node.js)
- A YouTube Data API v3 Key

### Installation & Setup

1.  **Obtain a YouTube API Key:**
    Follow the steps in the [YouTube API Setup](#youtube-api-setup) section below.

2.  **For Direct Use / Local Development:**

    ```bash
    # Clone this repository
    git clone https://github.com/kirbah/mcp-youtube.git
    cd mcp-youtube

    # Install dependencies
    npm install

    # Configure Environment
    # Create a .env file in the root by copying .env.example:
    cp .env.example .env
    # Then, edit .env to add your YOUTUBE_API_KEY:
    # YOUTUBE_API_KEY=your_youtube_api_key_here
    # YOUTUBE_TRANSCRIPT_LANG=en # Optional
    ```

3.  **For Use as an MCP Server (e.g., with Claude Desktop or custom client):**
    Once published to NPM, you can use `npx`:
    ```bash
    # No local clone needed if using the published NPM package
    # The MCP client will handle invoking it.
    ```

## Environment Configuration

Create a `.env` file in the root of the project by copying `.env.example` and filling in your details:

```
YOUTUBE_API_KEY=your_youtube_api_key_here
YOUTUBE_TRANSCRIPT_LANG=en # Optional: Default language for transcripts (e.g., 'en', 'ko', 'es')
```

- `YOUTUBE_API_KEY`: **Required**. Your YouTube Data API v3 key.
- `YOUTUBE_TRANSCRIPT_LANG`: Optional. Defaults to 'en' if not set in the environment, and your server logic uses this.

## YouTube API Setup

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  In the navigation menu, go to "APIs & Services" > "Library".
4.  Search for "YouTube Data API v3" and **Enable** it for your project.
5.  Go to "APIs & Services" > "Credentials".
6.  Click "+ CREATE CREDENTIALS" and choose "API key".
7.  Copy the generated API key. This is your `YOUTUBE_API_KEY`.
8.  **Important Security Step:** Restrict your API key to prevent unauthorized use. Click on the API key name, and under "API restrictions," select "Restrict key" and choose "YouTube Data API v3." You can also add "Application restrictions" (e.g., IP addresses) if applicable.

## Development

```bash
# Install dependencies
npm install

# Run in development mode with live reloading
npm run dev

# Build for production
npm run build

# Run the production build
npm start

# Lint files
npm run lint

# Run tests
npm run test

# Inspect MCP server using the Model Context Protocol Inspector
npm run inspector
```

## Usage with an MCP Client

This server is an MCP server that communicates via **Standard Input/Output (stdio)**. It does not listen on network ports. An MCP client application will typically spawn this server script as a child process and communicate by writing requests to its stdin and reading responses from its stdout.

**Example 1: If the package is published to npm (e.g., as `@kirbah/mcp-youtube`)**

An MCP client (like Claude Desktop or a custom client) might configure it as follows:

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": ["-y", "@kirbah/mcp-youtube"],
      "env": {
        // Environment variables for the spawned process
        "YOUTUBE_API_KEY": "YOUR_API_KEY_HERE",
        "YOUTUBE_TRANSCRIPT_LANG": "en" // Optional
      }
    }
  }
}
```

**Example 2: For local development with a client**

To have a client run your local development version:

1.  Add a dedicated script to your server's `package.json` if you don't want the client to use the `watch` mode from `npm run dev`:

    ```json
    "scripts": {
      // ...
      "start:client": "tsx ./src/index.ts" // Runs with tsx, no watch
    }
    ```

2.  The client can then be configured to spawn this script:
    ```json
    {
      "mcpServers": {
        "youtube_local_dev": {
          "command": "npm", // or "npm.cmd" on Windows for reliability
          "args": ["run", "start:client"],
          "working_directory": "/absolute/path/to/your/cloned/mcp-youtube" // CRITICAL: Set this correctly
          // "env": { ... } // Usually not needed if .env is loaded by the server script and working_directory is correct
        }
      }
    }
    ```
    _Note: The server loads `.env` from its root directory. If `working_directory` is set correctly for the `npm run` command, the server should pick up your `.env` file._

## System Requirements

- Node.js 20.0.0 or higher
- npm (for managing dependencies and running scripts)

## Security Considerations

- **API Key Security:** Your `YOUTUBE_API_KEY` is sensitive. Never commit it directly to your repository. Use environment variables (e.g., via a `.env` file which should be listed in `.gitignore`).
- **API Quotas:** The YouTube Data API has usage quotas. Monitor your usage in the Google Cloud Console. Consider setting budget alerts or quota limits for your API key to prevent unexpected charges or service disruptions.
- **Input Validation:** The server uses Zod for robust input validation for all tool parameters, enhancing security and reliability.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
