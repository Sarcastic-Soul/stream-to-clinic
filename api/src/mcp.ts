// The agent's read-only FHIR tools as a remote MCP server (Streamable HTTP, stateless), so any MCP
// client — Claude, an IDE, another agent — can query the same data. No model key is involved: the
// client brings its own model. Each request gets a fresh server and transport, so nothing is shared
// between callers.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import { TOOLS, TOOL_NAMES, ToolInputError, runTool } from "./agent-tools.js";

export const MCP_INSTRUCTIONS =
  "Read-only access to Stream-to-Clinic: citizen stream reports stored as OneAquaHealth FHIR Observations, the stream sites, " +
  "the clinics serving them, and the water-health alerts (DetectedIssue) a rule engine raised and sent to clinics (Communication). " +
  "All data is synthetic demo data. Each result lists the public FHIR query URLs behind it.";

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "stream-to-clinic", version: "1.0.0" }, { instructions: MCP_INSTRUCTIONS });
  for (const name of TOOL_NAMES) {
    const tool = TOOLS[name];
    server.registerTool(
      name,
      { description: tool.description, inputSchema: tool.input, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (args: unknown) => {
        try {
          const result = await runTool(name, args);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (err) {
          const message = err instanceof ToolInputError ? err.message : "The tool failed to read the FHIR server";
          return { content: [{ type: "text" as const, text: message }], isError: true };
        }
      },
    );
  }
  return server;
}

export function registerMcp(app: FastifyInstance) {
  app.post("/mcp", async (req, reply) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      req.log.error(err, "MCP request failed");
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "Content-Type": "application/json" });
        reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
      }
    }
  });

  // Stateless server: no sessions to resume or end, so there is no stream to open with GET.
  const notAllowed = { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. POST JSON-RPC to /mcp." }, id: null };
  app.get("/mcp", async (_req, reply) => reply.code(405).header("Allow", "POST").send(notAllowed));
  app.delete("/mcp", async (_req, reply) => reply.code(405).header("Allow", "POST").send(notAllowed));
}
