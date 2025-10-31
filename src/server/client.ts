/**
 * HTTP Client and Request Manager
 * 
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import axios from 'axios';
import fg from 'fast-glob';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sslChecker from 'ssl-checker';
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
    this.config = Config.validate(configPath);
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
    const pluginConfig = this.config.getRestApiConfig(params.vaultId);
    if (!pluginConfig) {
      return this.response(`Vault '${params.vaultId}' REST API not configured.`);
    }
    const useHttps = pluginConfig.enableSecureServer;
    const port = useHttps ? pluginConfig.port : pluginConfig.insecurePort;
    const protocol = useHttps ? 'https' : 'http';
    const host = pluginConfig.bindingHost ?? '127.0.0.1';
    const baseUrl = `${protocol}://${host}:${port}`;
    let httpsAgent = undefined;
    if (useHttps) {
      const sslInfo = await sslChecker(host, { method: 'HEAD', port });
      if (!sslInfo.valid) {
        httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }
    }
    const response = await axios({
      method: params.method,
      url: `${baseUrl}${params.path}`,
      headers: {
        'Authorization': `Bearer ${pluginConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      data: params.data,
      timeout: this.timeout,
      httpsAgent
    });
    return response.data;
  }

  /**
   * Gets notes from vault folder
   * 
   * Lists all note files in the specified folder of a vault using
   * Obsidian REST API. Returns array of file paths relative to vault root.
   * 
   * @param {string} vaultId - Vault identifier from configuration
   * @param {string} [folder] - Optional folder path within vault (e.g., "daily", "projects/work")
   * @returns {Promise<{ files: string[] } | Response>} Array of note file paths or error response
   */
  async getNotes(vaultId: string, folder?: string): Promise<{ files: string[] } | Response> {
    const vaultConfig = this.config.getVaultConfig(vaultId);
    if (!vaultConfig) {
      return this.response(`Vault '${vaultId}' not found in configuration.`);
    }
    const pattern = vaultConfig.extensions.length === 1
      ? `**/*${vaultConfig.extensions[0]}`
      : `**/*{${vaultConfig.extensions.join(',')}}`;
    const searchPath = folder ? join(vaultConfig.path, folder) : vaultConfig.path;
    const files = await fg(pattern, {
      cwd: searchPath,
      absolute: true,
      onlyFiles: true
    });
    return { files };
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
