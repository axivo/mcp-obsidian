/**
 * MCP Server implementation
 * 
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Client, Response } from './client.js';
import { Config, VaultConfig } from './config.js';
import { McpTool } from './tool.js';

/**
 * Parameters for getting notes from vault folder
 * 
 * @interface GetNotes
 * @property {string} vaultId - Vault identifier
 * @property {string} [folder] - Optional folder path
 */
interface GetNotes {
  vaultId: string;
  folder?: string;
}

/**
 * Mapping between vault capabilities, tool handlers, and MCP tool definitions
 * 
 * @interface ServerTools
 * @property {string} capability - Vault server capability name (e.g., 'vaultOperations')
 * @property {ToolHandler<any>} handler - Async handler function for tool execution
 * @property {Tool} tool - MCP tool definition with schema and metadata
 */
interface ServerTools {
  capability: string;
  handler: ToolHandler<any>;
  tool: Tool;
}

/**
 * Tools organized by capability with support status
 * 
 * @interface SupportedTools
 * @property {boolean} supported - Whether this capability is supported
 * @property {Tool[]} tools - Array of tools for this capability
 */
interface SupportedTools {
  supported: boolean;
  tools: Tool[];
}

/**
 * Capability to tool definition mapping
 * 
 * @interface ToolCapabilities
 * @property {string} capability - Vault server capability name
 * @property {Tool} tool - Corresponding MCP tool definition
 */
interface ToolCapabilities {
  capability: string;
  tool: Tool;
}

interface Vault extends VaultConfig {
  id: string;
}

/**
 * Generic tool handler function type
 * 
 * @template TArgs - Type of arguments passed to handler
 * @param {TArgs} args - Tool execution arguments
 * @returns {Promise<unknown>} Promise resolving to tool execution result
 */
type ToolHandler<TArgs = unknown> = (args: TArgs) => Promise<unknown>;

/**
 * MCP Server implementation for Obsidian vault management
 * 
 * Provides comprehensive interface for Obsidian operations through MCP tools,
 * managing server lifecycle, request routing, and Obsidian REST API integration.
 * 
 * @class McpServer
 */
export class McpServer {
  private client: Client;
  private config: Config;
  private server: Server;
  private tool: McpTool;
  private toolHandler: Map<string, ToolHandler>;

  /**
   * Creates a new McpServer instance with Obsidian configuration
   * 
   * Initializes Obsidian configuration loader, REST API client, MCP server,
   * and tool registry. Sets up handler mappings and prepares for transport connection.
   * 
   * @param {string} configPath - Absolute path to obsidian.json configuration file
   */
  constructor(configPath: string) {
    this.config = new Config(configPath);
    this.client = new Client(configPath);
    this.server = new Server(
      { name: 'obsidian', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.tool = new McpTool();
    this.toolHandler = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Handles tool execution requests from MCP clients
   * 
   * Routes incoming MCP tool requests to appropriate handler functions,
   * validates arguments, and formats responses for MCP protocol compliance.
   * 
   * @private
   * @param {CallToolRequest} request - MCP tool execution request with name and arguments
   * @returns {Promise<Response>} MCP-compliant response with execution results
   */
  private async handleRequest(request: CallToolRequest): Promise<Response> {
    if (!request.params.arguments) {
      return this.client.response('No arguments provided');
    }
    const handler = this.toolHandler.get(request.params.name);
    if (!handler) {
      return this.client.response(`Unknown tool: ${request.params.name}`);
    }
    const result = await handler(request.params.arguments);
    return this.client.response(result, typeof result === 'string' ? false : true);
  }

  /**
   * Handles tool listing requests from MCP clients
   * 
   * Returns complete list of available MCP tools with their schemas
   * and descriptions for client capability discovery.
   * 
   * @private
   * @returns {Promise<{tools: Tool[]}>} Complete tool registry for MCP protocol
   */
  private async handleTools(): Promise<{ tools: Tool[] }> {
    return { tools: this.tool.getTools() };
  }

  /**
   * Generates capability-based tools map for MCP tool exposure
   * 
   * Maps vault server capabilities to available MCP tools, creating a dynamic
   * tool registry based on what vault operations are supported.
   * 
   * @private
   * @param {ToolCapabilities[]} toolCapabilities - Available tool-to-capability mappings
   * @returns {Record<string, SupportedTools>} Capability-keyed mapping of supported tools
   */
  private generateToolsMap(toolCapabilities: ToolCapabilities[]): Record<string, SupportedTools> {
    const server = new Map<string, Tool[]>();
    const toolsMap: Record<string, SupportedTools> = {};
    for (const { tool, capability } of toolCapabilities) {
      if (!server.has(capability)) {
        server.set(capability, []);
      }
      server.get(capability)!.push(tool);
    }
    const vaultOperations = server.get('vaultOperations');
    if (vaultOperations && vaultOperations.length) {
      toolsMap['vaultOperations'] = { supported: true, tools: vaultOperations };
    }
    return toolsMap;
  }

  /**
   * Gets notes from vault folder
   * 
   * Lists all note files in the specified folder of a vault using
   * Obsidian REST API. Returns array of file paths relative to vault root.
   * 
   * @private
   * @param {{ vaultId: string; folder?: string }} args - Tool arguments with vault ID and optional folder path
   * @returns {Promise<{ files: string[] } | Response>} Array of note file paths or error response
   */
  private async getNotes(args: { vaultId: string; folder?: string }): Promise<{ files: string[] } | Response> {
    return this.client.getNotes(args.vaultId, args.folder);
  }

  /**
   * Gets MCP server capabilities and available tool mappings
   * 
   * Retrieves configured vaults and maps them to available MCP tools,
   * providing comprehensive capability inspection and tool discovery.
   * 
   * @private
   * @param {ToolCapabilities[]} [toolCapabilities] - Optional pre-computed tool capabilities
   * @returns {Promise<{vaults: Vault[], tools: Record<string, SupportedTools>}>} Vaults and tools mapping
   */
  private async getServerCapabilities(args?: { toolCapabilities?: ToolCapabilities[] }): Promise<unknown> {
    const { vaults } = await this.getVaults();
    let toolCapabilities = args?.toolCapabilities;
    if (!toolCapabilities) {
      toolCapabilities = this.setServerTools().map(({ tool, capability }) => ({ tool, capability }));
    }
    const tools = this.generateToolsMap(toolCapabilities);
    return { tools, vaults };
  }

  /**
   * Gets all configured vaults
   * 
   * Returns vault IDs with descriptions for vault discovery and selection.
   * 
   * @private
   * @returns {Promise<unknown>} Response containing vault list
   */
  private async getVaults(): Promise<{ vaults: Vault[] }> {
    const vaultIds = this.config.getVaults();
    const vaults = vaultIds.map(id => {
      const config: VaultConfig = this.config.getVaultConfig(id);
      return {
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        description: config.description ?? '',
        id,
        path: config.path
      };
    });
    return { vaults };
  }

  /**
   * Maps vault capabilities to corresponding MCP tools
   * 
   * Creates comprehensive mapping between vault capabilities and MCP tool handlers,
   * enabling dynamic tool availability based on vault features.
   * 
   * @private
   * @returns {ServerTools[]} Array of capability-to-tool-handler mappings
   */
  private setServerTools(): ServerTools[] {
    return [
      { capability: 'vaultOperations', handler: this.getNotes.bind(this), tool: this.tool.getNotes() },
      { capability: 'vaultOperations', handler: this.getServerCapabilities.bind(this), tool: this.tool.getServerCapabilities() },
      { capability: 'vaultOperations', handler: this.getVaults.bind(this), tool: this.tool.getVaults() }
    ];
  }

  /**
   * Configures MCP server request handlers
   * 
   * Sets up handlers for tool listing and tool execution requests,
   * establishing the MCP protocol communication layer.
   * 
   * @private
   */
  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleRequest.bind(this));
  }

  /**
   * Sets up tool handlers registry with argument processing
   * 
   * Registers all tool handlers with argument validation and default value injection,
   * creating wrapped handlers that process MCP arguments before execution.
   * 
   * @private
   */
  private setupToolHandlers(): void {
    const tools = this.setServerTools();
    for (const { tool, handler } of tools) {
      const wrappedHandler: ToolHandler = async (args: unknown) => {
        const processedArgs = args as Record<string, unknown>;
        const properties = tool.inputSchema?.properties;
        if (properties) {
          Object.entries(properties).forEach(([name, value]) => {
            const schema = value as { default?: unknown };
            if (processedArgs[name] === undefined && schema.default !== undefined) {
              processedArgs[name] = schema.default;
            }
          });
        }
        return await handler(processedArgs);
      };
      this.toolHandler.set(tool.name, wrappedHandler);
    }
  }

  /**
   * Connects the MCP server to stdio transport with error handling
   * 
   * Establishes MCP communication channel using standard input/output streams,
   * configures error handling, and starts message processing.
   * 
   * @param {StdioServerTransport} transport - Stdio transport for MCP communication
   * @returns {Promise<void>} Promise that resolves when connection is established and listening
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    transport.onerror = () => { };
    await this.server.connect(transport);
  }
}
