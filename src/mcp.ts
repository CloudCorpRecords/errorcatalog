/**
 * errorcatalog MCP server. Tools: catalog_errors.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod
 * still validates every tools/call argument set. When zod
 * rejects a call, the core validator is consulted so the
 * error names the offending path (e.g. "sources[0].content
 * is required") exactly as the spec requires.
 *
 * The cataloguing is pure local text analysis: no upstream
 * API, no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { catalogErrors, formatPayload, VERSION } from "./errorcatalog.js";

const FileArg = z.object({
  path: z.string(),
  content: z.string(),
});

const CatalogArgs = z.object({
  sources: z.array(FileArg).min(1),
  docs: z.array(FileArg).optional(),
});

const TOOLS = [
  {
    name: "catalog_errors",
    description:
      "Catalog every error thrown in the given sources, and whether each literal message is documented.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sources: {
          type: "array",
          description: "Source files to scan",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Source file path" },
              content: { type: "string", description: "Source file content" },
            },
            required: ["path", "content"],
          },
        },
        docs: {
          type: "array",
          description:
            "Documentation texts; literal messages are checked verbatim against them (optional)",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Documentation file path" },
              content: { type: "string", description: "Documentation file content" },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["sources"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "errorcatalog", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "catalog_errors") {
      const parsed = CatalogArgs.safeParse(args ?? {});
      if (!parsed.success) {
        // Let the core validator name the offending path; it
        // throws for every malformed sources/docs shape. If it
        // does not throw, fall back to the zod error.
        const raw = (args ?? {}) as { sources?: unknown; docs?: unknown };
        catalogErrors(raw.sources, raw.docs);
        throw parsed.error;
      }
      out = catalogErrors(parsed.data.sources, parsed.data.docs);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
