---
sidebar_position: 1
---

# Building an MCP Server

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is an open standard that lets AI applications connect to external tools, data sources, and services through a uniform interface. Think of it as a USB-C port for AI — any MCP-compatible client (Claude Desktop, Claude Code, or any other host) can connect to any MCP server using the same protocol.

This guide walks through building an MCP server from scratch using the official TypeScript SDK.

---

## Architecture

MCP is a client–server protocol built on **JSON-RPC 2.0**. The host application runs an MCP client; your server runs as a separate process (or remote service):

```
┌─────────────────────────────────────────────────┐
│  Host Application (Claude Desktop, Claude Code)  │
│                                                  │
│   ┌──────────────┐   ┌──────────────┐           │
│   │  MCP Client  │   │  MCP Client  │           │
│   └──────┬───────┘   └──────┬───────┘           │
└──────────┼─────────────────┼───────────────────┘
           │ stdio            │ HTTP/SSE
           ▼                  ▼
┌──────────────────┐  ┌─────────────────────────┐
│  Local Server    │  │  Remote Server           │
│  (subprocess)    │  │  (cloud hosted)          │
└──────────────────┘  └─────────────────────────┘
```

A server exposes three types of primitives:

| Primitive | Who controls it | Purpose |
|---|---|---|
| **Tools** | Model decides when to call | Executable functions — query a DB, call an API, run code |
| **Resources** | Host app decides when to attach | Data context — files, DB records, API responses |
| **Prompts** | User explicitly picks | Reusable prompt templates with arguments |

---

## Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "strict": true
  },
  "include": ["src"]
}
```

`package.json` — add these fields:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc && chmod 755 build/index.js",
    "dev": "node --watch build/index.js"
  },
  "bin": { "my-mcp-server": "./build/index.js" }
}
```

---

## The Minimal Server

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});

const transport = new StdioServerTransport();
await server.connect(transport);

// All logging MUST go to stderr — stdout is reserved for the JSON-RPC stream
console.error("Server running");
```

`McpServer` handles the initialization handshake automatically:
1. Client sends `initialize` with its protocol version and capabilities
2. Server responds with its version and capabilities
3. Client sends `notifications/initialized`
4. Both sides are now ready

---

## Tools

Tools are the most common primitive. The model picks a tool, the user approves, and the server executes it.

### Defining a Tool

```typescript
server.setRequestHandler({ method: "tools/list" }, async () => ({
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name or zip code",
          },
          units: {
            type: "string",
            enum: ["metric", "imperial"],
            default: "metric",
          },
        },
        required: ["location"],
      },
    },
  ],
}));
```

`inputSchema` is a standard JSON Schema object. Make `description` fields specific — the model uses them to decide when and how to call the tool.

### Handling a Tool Call

```typescript
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(
  { method: "tools/call" },
  async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_weather": {
        const location = args?.location as string;
        const units = (args?.units as string) ?? "metric";

        const data = await fetchWeather(location, units); // your logic

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  },
);
```

### Tool Result Content Types

A tool result is an array of `content` items. The model and user see all of them.

**Text** (most common):

```typescript
{ type: "text", text: "Query returned 42 rows." }
```

**Image** (rendered in the UI):

```typescript
{
  type: "image",
  data: "<base64-encoded-bytes>",
  mimeType: "image/png",
}
```

**Embedded resource** (attach a file inline):

```typescript
{
  type: "resource",
  resource: {
    uri: "file:///path/to/output.csv",
    mimeType: "text/csv",
    text: "col1,col2\n1,2\n3,4",
  },
}
```

**Structured content** (machine-readable alongside the text):

```typescript
return {
  content: [{ type: "text", text: "Temperature is 22°C" }],
  structuredContent: { temperature: 22, unit: "celsius" },
  isError: false,
};
```

Use `structuredContent` when the caller is another program that needs to parse the result reliably.

### Error Handling

There are two distinct error patterns:

**Protocol error** — throw an exception for invalid requests (wrong tool name, missing parameters). The client sees a JSON-RPC error object and the model cannot retry.

```typescript
throw new Error(`Unknown tool: ${name}`);
```

**Execution error** — return `isError: true` for business logic failures. The model receives this as context and can retry with different arguments.

```typescript
return {
  content: [{ type: "text", text: "Location not found. Try a full city name like 'San Francisco, CA'." }],
  isError: true,
};
```

When in doubt, prefer execution errors — they give the model a chance to self-correct.

### Notifying the Client When the Tool List Changes

If your server dynamically adds or removes tools:

```typescript
await server.notification({ method: "notifications/tools/list_changed" });
```

---

## Resources

Resources expose data that the host application can attach to a conversation as context. Unlike tools, the model does not call resources directly — the host decides when to include them.

### Static Resources

```typescript
server.setRequestHandler({ method: "resources/list" }, async () => ({
  resources: [
    {
      uri: "config://app/settings",
      name: "App Settings",
      description: "Current application configuration",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler({ method: "resources/read" }, async (request) => {
  const { uri } = request.params;

  if (uri === "config://app/settings") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(await loadConfig(), null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});
```

### Dynamic Resources with URI Templates

URI templates (RFC 6570) let one template pattern match many resources:

```typescript
server.setRequestHandler({ method: "resources/templates/list" }, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "database://{table}/{id}",
      name: "Database Record",
      description: "Fetch a single record from any table",
      mimeType: "application/json",
    },
    {
      uriTemplate: "file:///{path}",
      name: "Project File",
      description: "Read a file by path",
    },
  ],
}));
```

When the client requests `database://users/42`, your `resources/read` handler receives that exact URI — parse the template variables yourself:

```typescript
server.setRequestHandler({ method: "resources/read" }, async (request) => {
  const { uri } = request.params;
  const match = uri.match(/^database:\/\/(\w+)\/(\w+)$/);

  if (match) {
    const [, table, id] = match;
    const row = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(row) }],
    };
  }

  throw new Error(`Unrecognized URI: ${uri}`);
});
```

### Resource Content

For text content use `text`, for binary use `blob` (base64-encoded):

```typescript
// Text
{ uri, mimeType: "text/plain", text: "file contents here" }

// Binary
{ uri, mimeType: "image/png", blob: "<base64>" }
```

### Subscriptions and Change Notifications

If a resource can change while the client is connected:

```typescript
// Client subscribes
server.setRequestHandler({ method: "resources/subscribe" }, async (req) => {
  watchFile(req.params.uri, () => {
    server.notification({
      method: "notifications/resources/updated",
      params: { uri: req.params.uri },
    });
  });
  return {};
});
```

---

## Prompts

Prompts are named, reusable message templates. The user picks a prompt from a menu in the host UI; the server fills in any arguments and returns a list of messages to seed the conversation.

```typescript
server.setRequestHandler({ method: "prompts/list" }, async () => ({
  prompts: [
    {
      name: "code_review",
      description: "Review code for bugs, style, and performance",
      arguments: [
        { name: "code", description: "The code to review", required: true },
        { name: "language", description: "Programming language", required: false },
      ],
    },
  ],
}));

server.setRequestHandler({ method: "prompts/get" }, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "code_review") {
    const lang = args?.language ?? "unknown";
    return {
      description: "Code review prompt",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review the following ${lang} code for bugs, style issues, and performance:\n\n\`\`\`${lang}\n${args?.code}\n\`\`\``,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});
```

Prompt messages support the same content types as tool results (`text`, `image`, `resource`).

---

## Transports

### Stdio (local servers)

The default for locally installed servers. The host app spawns your server as a subprocess and communicates via stdin/stdout.

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

Rules:
- **stdout** is exclusively for JSON-RPC messages — never `console.log()`
- **stderr** is safe for logs — use `console.error()`

### Streamable HTTP (remote servers)

For cloud-hosted or multi-client servers. A single HTTP endpoint handles both POST (client → server) and GET (server → client via SSE).

```typescript
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamable-http.js";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  // SSE stream for server-initiated messages
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(3000);
```

**Security requirements for HTTP servers:**
- Validate the `Origin` header on every request (prevents DNS rebinding attacks)
- Use HTTPS in production
- Implement authentication (see below)
- Bind to `localhost` for local HTTP servers

### Deprecated: SSE Transport

The older `SSEServerTransport` (two separate endpoints: `GET /sse` + `POST /messages`) is still in the SDK but has been superseded by Streamable HTTP. Use `StreamableHTTPServerTransport` for new servers.

---

## Authentication (Remote Servers)

Remote servers typically authenticate via a bearer token in the `Authorization` header.

### Validating a Token in Handlers

```typescript
server.setRequestHandler(
  { method: "tools/call" },
  async (request, extra) => {
    const auth = extra?.request?.headers?.authorization;
    if (!auth?.startsWith("Bearer ") || !isValidToken(auth.slice(7))) {
      throw new Error("Unauthorized");
    }
    // proceed...
  },
);
```

### OAuth Client Credentials (Machine-to-Machine)

For automated, server-to-server connections the OAuth client credentials flow is recommended:

**Server side** — validate a JWT from the authorization server:

```typescript
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({ jwksUri: "https://auth.example.com/.well-known/jwks.json" });

async function verifyToken(token: string): Promise<boolean> {
  try {
    const { header } = jwt.decode(token, { complete: true }) as any;
    const key = await client.getSigningKey(header.kid);
    jwt.verify(token, key.getPublicKey(), { audience: "my-mcp-server" });
    return true;
  } catch {
    return false;
  }
}
```

**Client side** — use the SDK's built-in provider:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamable-http.js";

// The SDK handles token acquisition and refresh automatically
const transport = new StreamableHTTPClientTransport(
  new URL("https://mcp.example.com/mcp"),
  {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  },
);

const client = new Client({ name: "my-client", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);
```

---

## Connecting to Claude

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/absolute/path/to/build/index.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

For npm-published servers use `npx`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}
```

Restart Claude Desktop after editing. Check logs in `~/Library/Logs/Claude/` if something doesn't connect.

### Claude Code (CLI)

```bash
claude mcp add my-server node /absolute/path/to/build/index.js
```

Or for a remote server:

```bash
claude mcp add --transport sse my-remote-server https://mcp.example.com/sse
```

List configured servers:

```bash
claude mcp list
```

---

## Complete Example: Weather Server

A full working server with two tools using the US National Weather Service API:

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

const NWS_BASE = "https://api.weather.gov";

const server = new McpServer({ name: "weather", version: "1.0.0" });

async function nwsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${NWS_BASE}${path}`, {
    headers: { "User-Agent": "weather-mcp/1.0", Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`NWS API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Tools ──────────────────────────────────────────────────────────────────

server.setRequestHandler({ method: "tools/list" }, async () => ({
  tools: [
    {
      name: "get_alerts",
      description: "Active weather alerts for a US state",
      inputSchema: {
        type: "object",
        properties: {
          state: { type: "string", description: "Two-letter state code, e.g. CA" },
        },
        required: ["state"],
      },
    },
    {
      name: "get_forecast",
      description: "7-day weather forecast for a lat/lon coordinate",
      inputSchema: {
        type: "object",
        properties: {
          latitude:  { type: "number" },
          longitude: { type: "number" },
        },
        required: ["latitude", "longitude"],
      },
    },
  ],
}));

server.setRequestHandler(
  { method: "tools/call" },
  async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "get_alerts") {
        const state = args?.state as string;
        const data = await nwsFetch<any>(`/alerts/active/area/${state}`);
        const features: any[] = data.features ?? [];

        if (features.length === 0) {
          return { content: [{ type: "text", text: `No active alerts for ${state}.` }] };
        }

        const text = features.map((f) => {
          const p = f.properties;
          return `**${p.event}** — ${p.areaDesc}\nSeverity: ${p.severity}\n${p.headline}`;
        }).join("\n\n---\n\n");

        return { content: [{ type: "text", text }] };
      }

      if (name === "get_forecast") {
        const lat = args?.latitude as number;
        const lon = args?.longitude as number;

        const point = await nwsFetch<any>(`/points/${lat},${lon}`);
        const forecast = await nwsFetch<any>(point.properties.forecast.replace(NWS_BASE, ""));

        const periods: any[] = forecast.properties.periods.slice(0, 5);
        const text = periods.map((p) =>
          `**${p.name}**: ${p.temperature}°${p.temperatureUnit} — ${p.shortForecast}`
        ).join("\n");

        return { content: [{ type: "text", text }] };
      }

      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };

    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

// ── Start ──────────────────────────────────────────────────────────────────

await server.connect(new StdioServerTransport());
console.error("Weather MCP server running");
```

Build and test:

```bash
npm run build

# Smoke-test by sending a raw JSON-RPC message
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node build/index.js
```

---

## Capability Negotiation

During the initialization handshake both sides declare what they support. You do not need to implement this manually — `McpServer` handles it — but understanding the structure helps when debugging:

**Client → Server** (`initialize` request):

```json
{
  "protocolVersion": "2025-11-25",
  "capabilities": {
    "roots": { "listChanged": true },
    "sampling": {}
  },
  "clientInfo": { "name": "Claude Desktop", "version": "1.0.0" }
}
```

**Server → Client** (`initialize` response):

```json
{
  "protocolVersion": "2025-11-25",
  "capabilities": {
    "tools":     { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true },
    "prompts":   { "listChanged": true },
    "logging":   {}
  },
  "serverInfo": { "name": "my-server", "version": "1.0.0" }
}
```

Only advertise capabilities you actually implement. The client will call the corresponding methods if the capability is present.

---

## Server Logging

Send structured log messages to the client (displayed in the host UI, not stderr):

```typescript
await server.notification({
  method: "notifications/message",
  params: {
    level: "info",            // "debug" | "info" | "warning" | "error"
    logger: "weather-server",
    data: "Fetching forecast for 37.7749,-122.4194",
  },
});
```

The `logging` capability must be declared in your `initialize` response for clients to accept these.

---

## Checklist

- [ ] `stdout` contains only JSON-RPC messages — all debug output goes to `stderr`
- [ ] Tool `inputSchema` has `required` listing all mandatory fields
- [ ] Tool descriptions are specific enough for the model to pick the right one
- [ ] Execution errors return `isError: true` with actionable messages; protocol errors throw
- [ ] HTTP servers validate the `Origin` header and use HTTPS
- [ ] Secrets are passed via environment variables, not hardcoded
- [ ] Server is tested locally before registering with a host
