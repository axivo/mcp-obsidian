/**
 * Configuration Parser and Validator
 * 
 * @module server/config
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

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
 * Handles parsing, validation, and access to Obsidian vault configuration files
 * with comprehensive error handling, type safety, and Zod schema validation.
 * 
 * @export
 * @class Config
 */
export class Config {
  private config: ObsidianConfig;
  private readonly restApiDataPath = '.obsidian/plugins/obsidian-local-rest-api/data.json';
  private static readonly VaultConfigSchema = z.object({
    description: z.string().optional(),
    extensions: z.array(z.string()).min(1),
    path: z.string().min(1),
    settings: z.record(z.string(), z.unknown()).optional()
  });
  private static readonly ConfigSchema = z.object({
    vaults: z.record(z.string(), Config.VaultConfigSchema).refine(
      (vaults) => Object.keys(vaults).length > 0,
      { message: 'At least one vault configuration is required.' }
    )
  });

  /**
   * Creates a new Config instance with validated configuration
   * 
   * Private constructor ensures all instances are created through the static
   * factory method, guaranteeing proper validation before instantiation.
   * 
   * @private
   * @param {ObsidianConfig} config - Pre-validated configuration object
   */
  private constructor(config: ObsidianConfig) {
    this.config = config;
  }

  /**
   * Validates configuration from file
   * 
   * Reads JSON configuration file, validates structure and content using Zod schema,
   * and returns validated Config instance. Provides detailed error messages for
   * validation failures.
   * 
   * @static
   * @param {string} configPath - Absolute path to configuration JSON file
   * @returns {Config} Validated Config instance
   * @throws {Error} If file cannot be read or configuration is invalid
   */
  static validate(configPath: string): Config {
    try {
      const configData = readFileSync(configPath, 'utf-8');
      const parsedData = JSON.parse(configData);
      const validatedConfig = Config.ConfigSchema.parse(parsedData);
      return new Config(validatedConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e: z.core.$ZodIssue) =>
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');
        throw new Error(`Failed to load '${configPath}' configuration file: ${errors}`);
      }
      throw new Error(`Failed to load '${configPath}' configuration file: ${error}`);
    }
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
