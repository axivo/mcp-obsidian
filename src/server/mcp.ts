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
import { Config } from './config.js';
import { McpTool } from './tool.js';

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
   * Lists all configured vaults
   * 
   * Returns vault IDs with descriptions for vault discovery and selection.
   * 
   * @private
   * @returns {Promise<unknown>} Response containing vault list
   */
  private async listVaults(): Promise<unknown> {
    const vaults = this.config.getVaults();
    const vaultList = vaults.map(vaultId => {
      const config = this.config.getVaultConfig(vaultId);
      return {
        id: vaultId,
        description: config?.description || 'No description',
        path: config?.path || 'Unknown'
      };
    });
    return { vaults: vaultList };
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
   * Registers tool handlers in the handler map
   * 
   * Creates mapping between tool names and their implementation functions,
   * enabling dynamic tool execution routing.
   * 
   * @private
   */
  private setupToolHandlers(): void {
    this.toolHandler.set('list_vaults', this.listVaults.bind(this));
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
