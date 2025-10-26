/**
 * HTTP Client and Request Manager
 * 
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import axios from 'axios';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Config } from './config.js';

/**
 * HTTP request parameters for Obsidian REST API
 * 
 * @interface RequestParams
 * @property {string} vaultId - Vault identifier
 * @property {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @property {string} path - API endpoint path
 * @property {unknown} [data] - Optional request body data
 */
interface RequestParams {
  vaultId: string;
  method: string;
  path: string;
  data?: unknown;
}

/**
 * Standardized response format for MCP tool execution
 * 
 * @interface Response
 * @property {Array<{type: 'text', text: string}>} content - Response content array with text type
 * @property {unknown} [data] - Optional structured data payload
 */
export type Response = {
  content: Array<{ type: 'text'; text: string }>;
  data?: unknown;
};

/**
 * HTTP Client and Request Manager
 * 
 * Provides Obsidian REST API communication with proper authentication
 * and response formatting for MCP protocol.
 * 
 * @class Client
 */
export class Client {
  private config: Config;
  private readonly timeout: number = 10000;

  /**
   * Creates a new Client instance
   * 
   * @param {string} configPath - Path to the Obsidian configuration file
   */
  constructor(configPath: string) {
    this.config = new Config(configPath);
  }

  /**
   * Executes HTTP request to Obsidian REST API with vault-specific credentials
   * 
   * Internal helper method for making authenticated HTTP requests
   * with proper headers, timeout, and error handling.
   * 
   * @private
   * @template T - Expected response type
   * @param {RequestParams} params - Request parameters including vault ID, method, path, and optional data
   * @returns {Promise<T | Response>} Promise resolving to response data or error response
   */
  private async request<T>(params: RequestParams): Promise<T | Response> {
    const vaultConfig = this.config.getVaultConfig(params.vaultId);
    if (!vaultConfig) {
      return this.response(`Vault '${params.vaultId}' not found in configuration.`);
    }
    const response = await axios({
      method: params.method,
      url: `${vaultConfig.apiUrl}${params.path}`,
      headers: {
        'Authorization': `Bearer ${vaultConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      data: params.data,
      timeout: this.timeout
    });
    return response.data;
  }

  /**
   * Creates a standardized MCP response format
   * 
   * Converts responses into the MCP-compliant format
   * with optional structured data payload.
   * 
   * @param {unknown} message - Response message (string or object)
   * @param {boolean} [stringify=false] - Whether to JSON stringify non-string messages
   * @param {unknown} [data] - Optional structured data to include in response
   * @returns {Response} MCP-compliant response with content array and optional data
   */
  response(message: unknown, stringify: boolean = false, data?: unknown): Response {
    const text = typeof message === 'string' && !stringify ? message : JSON.stringify(message);
    const result: Response = { content: [{ type: 'text', text }] };
    if (data) {
      result.data = data;
    }
    return result;
  }

  /**
   * Gets package version from package.json
   * 
   * Reads version from package.json relative to current module location.
   * Returns error message string if reading fails rather than throwing.
   * 
   * @returns {string} Package version string or error message
   */
  version(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      return `Failed to read package.json version. ${error}`;
    }
  }
}
