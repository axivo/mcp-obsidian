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
import { z } from 'zod';
import { Client, Response } from './client.js';
import { Config, VaultConfig } from './config.js';
import { McpTool } from './tool.js';

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

/**
 * Vault identifier parameter
 * 
 * @interface VaultId
 * @property {string} vault_id - Vault identifier from configuration
 */
interface VaultId {
  vault_id: string;
}

/**
 * Get server capabilities request parameters
 * 
 * @interface GetServerCapabilities
 */
interface GetServerCapabilities { }

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
    this.config = Config.validate(configPath);
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
   * Maps all available MCP tools with their capabilities, creating a complete
   * tool registry for vault operations.
   * 
   * @private
   * @param {ToolCapabilities[]} toolCapabilities - Available tool-to-capability mappings
   * @returns {Record<string, SupportedTools>} Capability-keyed mapping of all supported tools
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
    for (const [capability, tools] of server.entries()) {
      toolsMap[capability] = { supported: true, tools };
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
   * Discovery tool that returns all configured vaults and available MCP tools.
   * Serves as the entry point for understanding what the MCP server can do.
   * 
   * @private
   * @param {GetServerCapabilities} args - Empty parameters object
   * @param {ToolCapabilities[]} [toolCapabilities] - Optional pre-computed tool capabilities
   * @returns {Promise<unknown>} Complete server capabilities with tools and vaults
   */
  private async getServerCapabilities(args: GetServerCapabilities, toolCapabilities?: ToolCapabilities[]): Promise<unknown> {
    if (!toolCapabilities) {
      toolCapabilities = this.setServerTools().map(({ tool, capability }) => ({ tool, capability }));
    }
    const tools = this.generateToolsMap(toolCapabilities);
    const { vaults } = await this.getVaults();
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
        description: config.description ?? '',
        extensions: config.extensions,
        id,
        path: config.path,
        settings: config.settings
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
    const tools: ServerTools[] = [
      { capability: 'getNotes', handler: this.getNotes.bind(this), tool: this.tool.getNotes() },
      { capability: 'getServerCapabilities', handler: this.getServerCapabilities.bind(this), tool: this.tool.getServerCapabilities() },
      { capability: 'getVaults', handler: this.getVaults.bind(this), tool: this.tool.getVaults() }
    ];
    return tools;
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
   * Validates required arguments for tool handler methods using Zod schemas
   * 
   * Performs runtime validation of tool arguments against required field specifications,
   * ensuring type safety and proper error handling for missing parameters.
   * 
   * @private
   * @param {unknown} args - Tool arguments object to validate
   * @param {string[]} fields - Array of required field names for validation
   * @returns {string | null} Error message if validation fails, null if all requirements met
   */
  private validate(args: unknown, fields: string[]): string | null {
    const type: Record<string, z.ZodType> = {};
    for (const field of fields) {
      if (field === 'query') {
        type[field] = z.string();
      } else {
        type[field] = z.union([
          z.number(),
          z.record(z.string(), z.unknown()).refine((obj) => Object.keys(obj).length > 0),
          z.string().min(1)
        ]);
      }
    }
    const schema = z.object(type);
    const result = schema.safeParse(args);
    if (!result.success) {
      const missing = result.error.issues.map(issue => issue.path[0]);
      return `Missing required arguments: ${missing.join(', ')}`;
    }
    return null;
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
