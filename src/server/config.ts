/**
 * Configuration Parser and Validator
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Global Obsidian configuration structure
 * 
 * @interface ObsidianConfig
 * @property {Record<string, VaultConfig>} vaults - Map of vault IDs to configurations
 */
export interface ObsidianConfig {
  vaults: Record<string, VaultConfig>;
}

/**
 * Configuration for a single Obsidian vault
 * 
 * @interface VaultConfig
 * @property {string} [description] - Optional vault description
 * @property {string[]} extensions - File extensions for notes
 * @property {string} path - Absolute path to vault directory
 * @property {Record<string, unknown>} [settings] - Optional Obsidian vault settings to sync
 */
export interface VaultConfig {
  description?: string;
  extensions: string[];
  path: string;
  settings?: Record<string, unknown>;
}

/**
 * Configuration from Obsidian Local REST API plugin
 * 
 * @interface PluginConfig
 * @property {string} apiKey - API key for authentication
 * @property {string} [bindingHost] - Optional binding host address
 * @property {boolean} enableInsecureServer - Whether HTTP server is enabled
 * @property {boolean} enableSecureServer - Whether HTTPS server is enabled
 * @property {number} insecurePort - HTTP server port
 * @property {number} port - HTTPS server port
 */
export interface PluginConfig {
  apiKey: string;
  bindingHost?: string;
  enableInsecureServer: boolean;
  enableSecureServer: boolean;
  insecurePort: number;
  port: number;
}

/**
 * Configuration loader and validator for Obsidian vaults
 * 
 * Manages loading, parsing, and validation of the obsidian.json configuration file
 * that defines all available Obsidian vaults and their connection parameters.
 * 
 * @class Config
 */
export class Config {
  private config: ObsidianConfig;
  private readonly restApiDataPath = '.obsidian/plugins/obsidian-local-rest-api/data.json';

  /**
   * Creates a new Config instance and loads vault configuration
   * 
   * @param {string} configPath - Absolute path to obsidian.json configuration file
   */
  constructor(configPath: string) {
    this.config = this.loadConfig(configPath);
  }

  /**
   * Loads and parses the Obsidian configuration file with error handling
   * 
   * Reads JSON configuration file, validates structure and content,
   * and returns safe configuration object with fallback on any errors.
   * 
   * @private
   * @param {string} configPath - Path to configuration file
   * @returns {ObsidianConfig} Parsed and validated configuration or empty fallback
   */
  private loadConfig(configPath: string): ObsidianConfig {
    const emptyConfig: ObsidianConfig = { vaults: {} };
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent) as ObsidianConfig;
      if (!this.validate(config)) {
        return emptyConfig;
      }
      return config;
    } catch (error) {
      return emptyConfig;
    }
  }

  /**
   * Validates comprehensive configuration structure and content rules
   * 
   * Performs validation of configuration including vault definitions,
   * API keys, URLs, and paths to ensure runtime safety and proper
   * Obsidian REST API initialization.
   * 
   * @private
   * @param {ObsidianConfig} config - Configuration object to validate against schema
   * @returns {boolean} True if configuration meets all validation requirements, false otherwise
   */
  private validate(config: ObsidianConfig): boolean {
    if (!config || typeof config !== 'object') {
      return false;
    }
    if (!config.vaults || typeof config.vaults !== 'object') {
      return false;
    }
    if (Object.keys(config.vaults).length === 0) {
      return false;
    }
    for (const vaultConfig of Object.values(config.vaults)) {
      if (!vaultConfig || typeof vaultConfig !== 'object') {
        return false;
      }
      if (!Array.isArray(vaultConfig.extensions) || vaultConfig.extensions.length === 0) {
        return false;
      }
      if (typeof vaultConfig.path !== 'string' || vaultConfig.path.trim() === '') {
        return false;
      }
      if (vaultConfig.settings !== undefined && typeof vaultConfig.settings !== 'object') {
        return false;
      }
    }
    return true;
  }

  /**
   * Gets Obsidian Local REST API plugin configuration
   * 
   * Reads configuration from the vault's plugin data.json file,
   * extracting API credentials and server settings.
   * 
   * @param {string} vaultId - Vault identifier (e.g., 'conversations', 'diary')
   * @returns {PluginConfig | null} Plugin configuration or null if plugin not configured
   */
  getRestApiConfig(vaultId: string): PluginConfig | null {
    const vaultConfig = this.getVaultConfig(vaultId);
    if (!vaultConfig) {
      return null;
    }
    const pluginDataPath = join(vaultConfig.path, this.restApiDataPath);
    if (!existsSync(pluginDataPath)) {
      return null;
    }
    const pluginData = JSON.parse(readFileSync(pluginDataPath, 'utf8'));
    return {
      apiKey: pluginData.apiKey,
      bindingHost: pluginData.bindingHost,
      enableInsecureServer: pluginData.enableInsecureServer ?? false,
      enableSecureServer: pluginData.enableSecureServer ?? true,
      insecurePort: pluginData.insecurePort,
      port: pluginData.port
    };
  }

  /**
   * Gets complete vault configuration for a specific vault
   * 
   * Retrieves full vault configuration including API key, URL, path,
   * and optional description.
   * 
   * @param {string} vaultId - Vault identifier (e.g., 'conversations', 'diary')
   * @returns {VaultConfig} Complete vault configuration
   */
  getVaultConfig(vaultId: string): VaultConfig {
    return this.config.vaults[vaultId];
  }

  /**
   * Gets all configured vault identifiers
   * 
   * Returns array of vault identifiers for all configured vaults,
   * enabling iteration and vault discovery operations.
   * 
   * @returns {string[]} Array of vault identifiers (e.g., ['conversations', 'diary'])
   */
  getVaults(): string[] {
    return Object.keys(this.config.vaults);
  }

  /**
   * Checks if a vault configuration exists
   * 
   * Validates whether a vault is properly configured
   * and available for use within the current configuration.
   * 
   * @param {string} vaultId - Vault identifier (e.g., 'conversations', 'diary')
   * @returns {boolean} True if vault is configured and available, false otherwise
   */
  hasVaultConfig(vaultId: string): boolean {
    return vaultId in this.config.vaults;
  }
}
