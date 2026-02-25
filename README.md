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
  <!-- NPM Downloads -->
  <a href="https://www.npmjs.com/package/@kirbah/mcp-youtube">
    <img src="https://img.shields.io/npm/dt/@kirbah/mcp-youtube.svg" alt="NPM Downloads" />
  </a>
  <!-- Node Version -->
  <a href="package.json">
    <img src="https://img.shields.io/node/v/@kirbah/mcp-youtube.svg" alt="Node.js Version Support" />
  </a>
</p>

<a href="https://glama.ai/mcp/servers/@kirbah/mcp-youtube">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@kirbah/mcp-youtube/badge" />
</a>
<!-- Badges End -->

**A production-grade YouTube Data MCP server engineered specifically for AI agents.**

Unlike standard API wrappers that flood your LLM with redundant data, this server strips away YouTube's heavy payload bloat. It is designed to save you massive amounts of context window tokens, protect your daily API quotas via caching, and run reliably without breaking your workflows.

## Why Choose This Server?

Most MCP servers are weekend projects. `@kirbah/mcp-youtube` is built for reliable, daily, cost-effective agentic workflows.

### 📉 1. Save Up to 75% on Tokens (and Context Window)

The raw YouTube API returns massive JSON payloads filled with nested eTags, redundant thumbnails, and localization data that LLMs don't need. This server structures the data to give your LLM exactly what it needs to reason, and nothing else.

```mermaid
%%{init: { "theme": "base", "themeVariables": { "xyChart": { "plotColorPalette": "#ef4444, #22c55e" } } } }%%
xychart-beta
    title "Token Consumption (Lower is Better)"
    x-axis ["getVideoDetails", "searchVideos", "getChannelStats"]
    y-axis "Context Tokens" 0 --> 1200
    bar "Raw YouTube API" [854, 1115, 673]
    bar "MCP-YouTube (Optimized)" [209, 402, 86]
```

| API Method                 | Raw YouTube Tokens | MCP-YouTube Tokens | Token Savings | Data Size       |
| :------------------------- | :----------------- | :----------------- | :------------ | :-------------- |
| **`getChannelStatistics`** | 673                | **86**             | **~87% Less** | 1.8 KB ➔ 0.2 KB |
| `getVideoDetails`          | 854                | **209**            | **~75% Less** | 2.9 KB ➔ 0.6 KB |
| `searchVideos`             | 1115               | **402**            | **~64% Less** | 3.4 KB ➔ 1.2 KB |

_(Curious? You can compare the [raw API responses vs optimized outputs](examples/comparisons/) in the examples folder)._

### 🛡️ 2. Protect Your API Quotas (Smart Caching)

The YouTube Data API has strict daily limits (10,000 quota units). If your LLM gets stuck in a loop or re-asks a question, standard servers will drain your API limit in minutes.
This server includes an optional **MongoDB caching layer**. If your agent requests a video details or searches the same trending videos twice, the server serves it from the cache - costing you **0 API quota points**.

### 🏗️ 3. Production-Grade & Actively Maintained

Tired of MCP tools crashing your AI client? This server is built to be a rock-solid dependency:

- **97% Test Coverage:** Comprehensively unit-tested (check the Codecov badge).
- **Zero Lint Errors/Warnings:** Enforces strict, clean code (`npm run lint` passes 100%).
- **Active Security:** Automated Dependabot patching ensures underlying libraries are never left with known vulnerabilities.
- **Strict Type Safety:** Built using Zod validation and the robust MCP TypeScript Starter architecture.

---

## Quick Start: Installation

The easiest way to install this server is by clicking the **"Add to Claude Desktop"** (or other supported clients) button on our [Glama server page](https://glama.ai/mcp/servers/@kirbah/mcp-youtube).

### Manual Configuration

If you prefer to configure your MCP client manually (e.g., Claude Desktop or Cursor), add the following to your configuration file:

1. **Get a YouTube Data API v3 Key** (See [Setup Instructions](#youtube-api-setup) below).
2. **(Highly Recommended) Get a free MongoDB Connection String** to enable quota-saving caching.

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": ["-y", "@kirbah/mcp-youtube"],
      "env": {
        "YOUTUBE_API_KEY": "YOUR_YOUTUBE_API_KEY_HERE",
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://user:pass@cluster0.abc.mongodb.net/youtube_niche_analysis"
      }
    }
  }
}
```

_(Windows PowerShell Users: If `npx` fails, try using `"command": "cmd"` and `"args": ["/k", "npx", "-y", "@kirbah/mcp-youtube"]`)_

## Key Features

- **Optimized Video Information:** Search videos with advanced filters. Retrieve detailed metadata, statistics (views, likes, etc.), and content details, all structured for minimal token footprint.
- **Efficient Transcript Management:** Fetch video captions/subtitles with multi-language support, perfect for content analysis by LLMs.
- **Insightful Channel Analysis:** Get concise channel statistics (subscribers, views, video count) and discover a channel's top-performing videos without data bloat.
- **Lean Trend Discovery:** Find trending videos by region and category, and get lists of available video categories, optimized for quick AI processing.
- **Structured for AI:** All responses are designed to be easily parsable and immediately useful for language models.
- **Efficient Comment Retrieval:** Fetch video comments with fine-grained control over the number of results and replies, optimized for sentiment analysis and feedback extraction.

## Available Tools

The server provides the following MCP tools, each designed to return token-optimized data:

| Tool Name                       | Description                                                                                                                                  | Parameters (see details in tool schema)                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getVideoDetails`               | Retrieves detailed, **lean** information for multiple YouTube videos including metadata, statistics, engagement ratios, and content details. | `videoIds` (array of strings)                                                                                                                             |
| `searchVideos`                  | Searches for videos or channels based on a query string with various filtering options, returning **concise** results.                       | `query` (string), `maxResults` (optional number), `order` (optional), `type` (optional), `channelId` (optional), etc.                                     |
| `getTranscripts`                | Retrieves **token-efficient** transcripts (captions) for multiple videos, with options for full text or key segments (intro/outro).          | `videoIds` (array of strings), `lang` (optional string for language code), `format` (optional enum: 'full_text', 'key_segments' - default 'key_segments') |
| `getChannelStatistics`          | Retrieves **lean** statistics for multiple channels (subscriber count, view count, video count, creation date).                              | `channelIds` (array of strings)                                                                                                                           |
| `getChannelTopVideos`           | Retrieves a list of a channel's top-performing videos with **lean** details and engagement ratios.                                           | `channelId` (string), `maxResults` (optional number)                                                                                                      |
| `getTrendingVideos`             | Retrieves a list of trending videos for a given region and optional category, with **lean** details and engagement ratios.                   | `regionCode` (optional string), `categoryId` (optional string), `maxResults` (optional number)                                                            |
| `getVideoCategories`            | Retrieves available YouTube video categories (ID and title) for a specific region, providing **essential data only**.                        | `regionCode` (optional string)                                                                                                                            |
| `getVideoComments`              | Retrieves comments for a YouTube video. Allows sorting, limiting results, and fetching a small number of replies per comment.                | `videoId` (string), `maxResults` (optional number), `order` (optional), `maxReplies` (optional number), `commentDetail` (optional string)                 |
| `findConsistentOutlierChannels` | Identifies channels that consistently perform as outliers within a specific niche. **Requires a MongoDB connection.**                        | `niche` (string), `minVideos` (optional number), `maxChannels` (optional number)                                                                          |

_For detailed input parameters and their descriptions, please refer to the `inputSchema` within each tool's configuration file in the `src/tools/` directory (e.g., `src/tools/video/getVideoDetails.ts`)._

> _**Note on API Quota Costs:** Most tools are highly efficient. `getVideoDetails`, `getChannelStatistics`, and `getTrendingVideos` cost only **1 unit** per call. The `getTranscripts` tool has **0** API cost. The new `getVideoComments` tool has a variable cost: the base call is **1 unit**, but if you request replies (by setting `maxReplies > 0`), it costs an **additional 1 unit for each top-level comment** it fetches replies for. The search-based tools are the most expensive: `searchVideos` costs **100 units** and `getChannelTopVideos` costs **101 units**._

## Advanced Usage & Local Development

If you wish to contribute, modify the server, or run it locally outside of an MCP client's managed environment:

### Prerequisites

- Node.js (version specified in `package.json` engines field - currently `>=20.0.0`)
- npm (usually comes with Node.js)
- A YouTube Data API v3 Key (see [YouTube API Setup](#youtube-api-setup))

### Local Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/kirbah/mcp-youtube.git
    cd mcp-youtube
    ```

2.  **Install dependencies:**

    ```bash
    npm ci
    ```

3.  **Configure Environment:**
    Create a `.env` file in the root by copying `.env.example`:
    ```bash
    cp .env.example .env
    ```
    Then, edit `.env` to add your `YOUTUBE_API_KEY`:
    ```
    YOUTUBE_API_KEY=your_youtube_api_key_here
    MDB_MCP_CONNECTION_STRING=your_mongodb_connection_string_here
    ```

### Development Scripts

```bash
# Run in development mode with live reloading
npm run dev

# Build for production
npm run build

# Run the production build (after npm run build)
npm start

# Lint files
npm run lint

# Run tests
npm run test
npm run test -- --coverage # To generate coverage reports

# Inspect MCP server using the Model Context Protocol Inspector
npm run inspector
```

### Local Development with an MCP Client

To have an MCP client run your _local development version_ (instead of the published NPM package):

1.  Ensure you have a script in `package.json` for a non-watching start, e.g.:

    ```json
    "scripts": {
      "start:client": "tsx ./src/index.ts"
    }
    ```

2.  Configure your MCP client to spawn this local script:
    ```json
    {
      "mcpServers": {
        "youtube_local_dev": {
          "command": "npm",
          "args": ["run", "start:client"],
          "working_directory": "/absolute/path/to/your/cloned/mcp-youtube",
          "env": {
            "YOUTUBE_API_KEY": "YOUR_LOCAL_DEV_API_KEY_HERE"
          }
        }
      }
    }
    ```
    _Note on the env block above: Setting YOUTUBE_API_KEY directly in the env block for the client configuration is one way to provide the API key. Alternatively, if your server correctly loads its .env file based on the working_directory, you might not need to specify it in the client's env block, as long as your local .env file in the project root contains the YOUTUBE_API_KEY. The working_directory path must be absolute and correct for the server to find its .env file._

## YouTube API Setup

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  In the navigation menu, go to "APIs & Services" > "Library".
4.  Search for "YouTube Data API v3" and **Enable** it for your project.
5.  Go to "APIs & Services" > "Credentials".
6.  Click "+ CREATE CREDENTIALS" and choose "API key".
7.  Copy the generated API key. This is your `YOUTUBE_API_KEY`.
8.  **Important Security Step:** Restrict your API key to prevent unauthorized use. Click on the API key name, and under "API restrictions," select "Restrict key" and choose "YouTube Data API v3." You can also add "Application restrictions" (e.g., IP addresses) if applicable.

## System Requirements

- Node.js: `>=20.0.0` (as specified in `package.json`)
- npm (for managing dependencies and running scripts)

## Deep Dive: `findConsistentOutlierChannels` Tool

The `findConsistentOutlierChannels` tool is designed to identify emerging or established YouTube channels that consistently outperform their size within a specific niche. This tool is particularly useful for content creators, marketers, and analysts looking for high-potential channels.

**Important Note:** This tool **requires a MongoDB connection** to store and analyze channel data. Without `MDB_MCP_CONNECTION_STRING` configured, this tool will not be available.

### Internal Logic Overview

The tool operates through a multi-phase analysis process, leveraging both YouTube Data API and a MongoDB database:

1.  **Candidate Search (Phase 1):**
    - Uses the provided `query` to search for relevant videos and channels on YouTube.
    - Filters initial results based on `videoCategoryId` and `regionCode` if specified.
    - Collects a broad set of potential channels for deeper analysis.

2.  **Channel Filtering (Phase 2):**
    - Retrieves detailed statistics for candidate channels (subscribers, total views, video count).
    - Filters channels based on `channelAge` (e.g., 'NEW' for channels under 6 months, 'ESTABLISHED' for 6-24 months).
    - Ensures channels meet a minimum video count to be considered for consistency.

3.  **Deep Analysis (Phase 3):**
    - For each filtered channel, fetches their recent top-performing videos.
    - Calculates a "viral factor" for each video (e.g., views relative to subscriber count).
    - Assesses the `consistencyLevel` (e.g., 'MODERATE' for ~30% of videos showing outlier performance, 'HIGH' for ~50%).
    - Determines `outlierMagnitude` (e.g., 'STANDARD' for views > subscribers, 'STRONG' for views > 3x subscribers).

4.  **Ranking & Formatting (Phase 4):**
    - Ranks channels based on their consistency, outlier magnitude, and overall performance within the niche.
    - Formats the results into a token-optimized structure suitable for LLMs, including key channel metrics and examples of outlier videos.

### Key Parameters Controlling the Flow

The behavior of this tool is primarily controlled by the following parameters:

- `query` (string, required): The central topic or niche to analyze (e.g., "DIY home repair", "quantum computing explained").
- `channelAge` (enum: "NEW", "ESTABLISHED", default: "NEW"): Focuses the search on emerging or more mature channels.
- `consistencyLevel` (enum: "MODERATE", "HIGH", default: "MODERATE"): Sets the threshold for how consistently a channel's videos must perform as outliers.
- `outlierMagnitude` (enum: "STANDARD", "STRONG", default: "STANDARD"): Defines how significantly a video's performance must exceed typical expectations (e.g., views vs. subscribers) to be considered an "outlier."
- `videoCategoryId` (string, optional): Narrows the search to a specific YouTube category ID.
- `regionCode` (string, optional): Targets channels relevant to a particular geographical region.
- `maxResults` (number, default: 10): Limits the number of top outlier channels returned.

## Security Considerations

- **API Key Security:** Your `YOUTUBE_API_KEY` is sensitive. Never commit it directly to your repository. Use environment variables (e.g., via a `.env` file which should be listed in `.gitignore`).
- **API Quotas:** The YouTube Data API has a daily usage quota (default is 10,000 units). All tool calls deduct from this quota. Monitor your usage in the Google Cloud Console and be mindful of the cost of each tool. For a detailed breakdown of costs per API method, see the [official documentation](https://developers.google.com/youtube/v3/determine_quota_cost).
- **Input Validation:** The server uses Zod for robust input validation for all tool parameters, enhancing security and reliability.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
