/**
 * Configuration Parser and Validator
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { readFileSync } from 'node:fs';

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
 * @property {string} apiKey - API key for local REST API plugin
 * @property {string} apiUrl - API URL for local REST API instance
 * @property {string} [description] - Optional vault description
 * @property {string} path - Absolute path to vault directory
 */
export interface VaultConfig {
  apiKey: string;
  apiUrl: string;
  description?: string;
  path: string;
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
      if (typeof vaultConfig.apiKey !== 'string' || vaultConfig.apiKey.trim() === '') {
        return false;
      }
      if (typeof vaultConfig.apiUrl !== 'string' || vaultConfig.apiUrl.trim() === '') {
        return false;
      }
      if (typeof vaultConfig.path !== 'string' || vaultConfig.path.trim() === '') {
        return false;
      }
    }
    return true;
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
