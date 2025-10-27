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
      this.getNotes(),
      this.getServerCapabilities(),
      this.getVaults()
    ];
  }

  /**
   * Creates MCP tool for listing notes in a vault folder
   * 
   * Lists all notes in the specified folder of a vault, or in the root
   * if no folder is specified. Returns array of note file paths.
   * 
   * @returns {Tool} MCP tool definition for listing notes in folder
   */
  getNotes(): Tool {
    return {
      name: 'get_notes',
      description: 'List notes in vault folder',
      inputSchema: {
        type: 'object',
        properties: {
          vaultId: { type: 'string', description: 'Vault identifier from configuration' },
          folder: { type: 'string', description: 'Optional folder path within vault', default: '' }
        },
        required: ['vaultId']
      }
    };
  }

  /**
   * Creates MCP tool for MCP server capability inspection
   * 
   * Retrieves comprehensive server capabilities and maps them to available MCP tools
   * for dynamic tool discovery and understanding vault operations.
   * 
   * @returns {Tool} MCP tool definition for server capability analysis
   */
  getServerCapabilities(): Tool {
    return {
      name: 'get_server_capabilities',
      description: 'Get MCP server capabilities and tool mappings',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
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
