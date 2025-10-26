/**
 * MCP Tool Definitions
 * 
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool Definitions for Obsidian Vault Integration
 * 
 * Provides comprehensive MCP tool definitions that bridge Obsidian REST API
 * with Model Context Protocol, enabling Claude agents to interact with vaults.
 * 
 * @class McpTool
 */
export class McpTool {

  /**
   * Creates a new McpTool instance
   */
  constructor() {
  }

  /**
   * Gets all tool definitions
   * 
   * Returns complete array of all available MCP tools for registration
   * with the MCP server.
   * 
   * @returns {Tool[]} Array of all tool definitions
   */
  getTools(): Tool[] {
    return [
      this.getVaults()
    ];
  }

  /**
   * Creates MCP tool for getting configured vaults
   * 
   * Returns a list of all configured vaults with their descriptions,
   * enabling vault discovery and selection.
   * 
   * @returns {Tool} MCP tool definition for getting configured vaults
   */
  getVaults(): Tool {
    return {
      name: 'get_vaults',
      description: 'Get all configured Obsidian vaults',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }
}
