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

<p align="left">
  <a href="https://smithery.ai/server/@kirbah/mcp-youtube">
    <img src="https://smithery.ai/badge/@kirbah/mcp-youtube" alt="View on Smithery" />
  </a>
</p>
<!-- Badges End -->

**High-efficiency YouTube MCP server: Get token-optimized, structured data for your LLMs using the YouTube Data API v3.**

This Model Context Protocol (MCP) server empowers AI language models to seamlessly interact with YouTube. It's engineered to return **lean, structured data**, significantly **reducing token consumption** and making it ideal for cost-effective and performant LLM applications. Access a comprehensive suite of tools for video search, detail retrieval, transcript fetching, channel analysis, and trend discovery—all optimized for AI.

## Quick Start: Adding to an MCP Client

The easiest way to use `@kirbah/mcp-youtube` is with an MCP-compatible client application (like Claude Desktop or a custom client).

1.  **Ensure you have a YouTube Data API v3 Key.**
    - If you don't have one, follow the [YouTube API Setup](#youtube-api-setup) instructions below.

2.  **MongoDB Connection String:** This server uses MongoDB to cache API responses and store analysis data, which significantly improves performance and reduces API quota usage. You can get a free MongoDB Atlas cluster to obtain a connection string.

3.  **Configure your MCP client:**
    Add the following JSON configuration to your client, replacing `"YOUR_YOUTUBE_API_KEY_HERE"` with your actual API key.

    ```json
    {
      "mcpServers": {
        "youtube": {
          "command": "npx",
          "args": ["-y", "@kirbah/mcp-youtube"],
          "env": {
            "YOUTUBE_API_KEY": "YOUR_YOUTUBE_API_KEY_HERE",
            "MDB_MCP_CONNECTION_STRING": "mongodb+srv://user:pass@cluster0.abc.mongodb.net/your_database_name"
          }
        }
      }
    }
    ```

    - **Windows PowerShell Users:** `npx` can sometimes cause issues directly. If you encounter problems, try modifying the command as follows:
      ```json
        "command": "cmd",
        "args": ["/k", "npx", "-y", "@kirbah/mcp-youtube"],
      ```

That's it! Your MCP client should now be able to leverage the YouTube tools provided by this server.

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

| Tool Name              | Description                                                                                                                                                                                                                                   | Parameters (see details in tool schema)                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `getVideoDetails`      | Retrieves detailed, **lean** information for multiple YouTube videos including metadata, statistics, engagement ratios, and content details.                                                                                                  | `videoIds` (array of strings)                                                                                         |
| `searchVideos`         | Searches for videos or channels based on a query string with various filtering options, returning **concise** results.                                                                                                                        | `query` (string), `maxResults` (optional number), `order` (optional), `type` (optional), `channelId` (optional), etc. |
| `getTranscripts`       | Retrieves **token-efficient** transcripts (captions) for multiple videos. **Note: This tool is currently non-functional due to recent changes on YouTube's side and the lack of working open-source utilities that can extract transcripts.** | `videoIds` (array of strings), `lang` (optional string for language code)                                             |
| `getChannelStatistics` | Retrieves **lean** statistics for multiple channels (subscriber count, view count, video count, creation date).                                                                                                                               | `channelIds` (array of strings)                                                                                       |
| `getChannelTopVideos`  | Retrieves a list of a channel's top-performing videos with **lean** details and engagement ratios.                                                                                                                                            | `channelId` (string), `maxResults` (optional number)                                                                  |
| `getTrendingVideos`    | Retrieves a list of trending videos for a given region and optional category, with **lean** details and engagement ratios.                                                                                                                    | `regionCode` (optional string), `categoryId` (optional string), `maxResults` (optional number)                        |
| `getVideoCategories`   | Retrieves available YouTube video categories (ID and title) for a specific region, providing **essential data only**.                                                                                                                         | `regionCode` (optional string)                                                                                        |

_For detailed input parameters and their descriptions, please refer to the `inputSchema` within each tool's configuration file in the `src/tools/` directory (e.g., `src/tools/video/getVideoDetails.ts`)._

> _**Note on API Quota Costs:** Most tools are highly efficient, costing only **1 unit** per call. The exceptions are the search-based tools: `searchVideos` costs **100 units** and `getChannelTopVideos` costs **101 units**. The `getTranscripts` tool has **0** API cost._

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

## How it Works (MCP stdio)

This server is an MCP server that communicates via **Standard Input/Output (stdio)**. It does not listen on network ports. An MCP client application will typically spawn this server script as a child process and communicate by writing requests to its stdin and reading responses from its stdout.

## System Requirements

- Node.js: `>=20.0.0` (as specified in `package.json`)
- npm (for managing dependencies and running scripts)

## Security Considerations

- **API Key Security:** Your `YOUTUBE_API_KEY` is sensitive. Never commit it directly to your repository. Use environment variables (e.g., via a `.env` file which should be listed in `.gitignore`).
- **API Quotas:** The YouTube Data API has a daily usage quota (default is 10,000 units). All tool calls deduct from this quota. Monitor your usage in the Google Cloud Console and be mindful of the cost of each tool. For a detailed breakdown of costs per API method, see the [official documentation](https://developers.google.com/youtube/v3/determine_quota_cost).
- **Input Validation:** The server uses Zod for robust input validation for all tool parameters, enhancing security and reliability.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
