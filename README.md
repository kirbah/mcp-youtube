# YouTube Data MCP Server (mcp-youtube)

A Model Context Protocol (MCP) server that allows AI language models to interact with YouTube content using the YouTube Data API v3. This server provides tools to search videos, retrieve video details, fetch transcripts, analyze channel data, and discover trending content.

## Key Features

- **Video Information:** Search videos with advanced filters, get detailed metadata, statistics (views, likes, etc.), and content details.
- **Transcript Management:** Retrieve video captions/subtitles with multi-language support.
- **Channel Analysis:** Get channel statistics (subscribers, views, video count) and discover a channel's top-performing videos.
- **Trend Discovery:** Find trending videos by region and category, and get a list of available video categories.
- **Data Optimization:** Returns lean, structured data to minimize token consumption by AI models.

## Available Tools

The server provides the following MCP tools:

| Tool Name              | Description                                                                                                                              | Parameters (see details in tool schema)                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `getVideoDetails`      | Retrieves detailed, lean information for multiple YouTube videos including metadata, statistics, engagement ratios, and content details. | `videoIds` (array of strings)                                                                                         |
| `searchVideos`         | Searches for videos or channels based on a query string with various filtering options (e.g., order, duration, recency).                 | `query` (string), `maxResults` (optional number), `order` (optional), `type` (optional), `channelId` (optional), etc. |
| `getTranscripts`       | Retrieves transcripts (captions) for multiple videos.                                                                                    | `videoIds` (array of strings), `lang` (optional string for language code)                                             |
| `getChannelStatistics` | Retrieves lean statistics for multiple channels (subscriber count, view count, video count, creation date).                              | `channelIds` (array of strings)                                                                                       |
| `getChannelTopVideos`  | Retrieves a list of a channel's top-performing videos with lean details and engagement ratios.                                           | `channelId` (string), `maxResults` (optional number)                                                                  |
| `getTrendingVideos`    | Retrieves a list of trending videos for a given region and optional category, with lean details and engagement ratios.                   | `regionCode` (optional string), `categoryId` (optional string), `maxResults` (optional number)                        |
| `getVideoCategories`   | Retrieves available YouTube video categories (ID and title) for a specific region.                                                       | `regionCode` (optional string)                                                                                        |

_For detailed input parameters and their descriptions, please refer to the `inputSchema` within each tool's configuration file in the `src/tools/` directory (e.g., `src/tools/video/getVideoDetails.ts`)._

## Installation

```bash
# Clone this repository (replace with your actual GitHub username if different)
git clone https://github.com/kirbah/mcp-youtube.git
cd mcp-youtube
npm install
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

**Example 1: If the package is published to npm (e.g., as `mcp-youtube`)**

An MCP client (like Claude Desktop or a custom client) might configure it as follows:

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": ["-y", "mcp-youtube"], // Use your actual published package name
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

- Node.js 18.0.0 or higher
- npm (for managing dependencies and running scripts)

## Security Considerations

- **API Key Security:** Your `YOUTUBE_API_KEY` is sensitive. Never commit it directly to your repository. Use environment variables (e.g., via a `.env` file which should be listed in `.gitignore`).
- **API Quotas:** The YouTube Data API has usage quotas. Monitor your usage in the Google Cloud Console. Consider setting budget alerts or quota limits for your API key to prevent unexpected charges or service disruptions.
- **Input Validation:** The server uses Zod for robust input validation for all tool parameters, enhancing security and reliability.

## License

This project is licensed under the MIT License.
