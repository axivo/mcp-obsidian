# Obsidian MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/claude/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-obsidian.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-obsidian)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=5.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A comprehensive MCP (Model Context Protocol) server that enables Claude to interact with Obsidian vaults for reading notes, managing vault configurations, and discovering available tools.

## Features

### Core Capabilities

- **Multi-Vault Support**: Manage multiple Obsidian vaults simultaneously
- **Note Discovery**: List and access notes within vault folders
- **Configuration Management**: Centralized vault configuration via JSON
- **Tool Discovery**: Dynamic capability inspection for available MCP tools

### Security & Performance

- **Direct File Access**: No external processes or daemons required
- **Configuration Validation**: Ensures vault configurations are correct before operations
- **Flexible Extensions**: Support for multiple markdown file extensions

## Getting Started

Ask Claude to discover available vaults and tools:

- *Get the Obsidian server capabilities to familiarize yourself with the supported tools.*
- *List the notes in the conversations vault.*

## MCP Tools

### Server Management Tools

1. **`get_server_capabilities`**
   - Get MCP server capabilities and tool mappings
   - Inputs: None (no parameters required)
   - Returns: Complete list of configured vaults and available MCP tools

2. **`get_vaults`**
   - Get all configured Obsidian vaults
   - Inputs: None (no parameters required)
   - Returns: Array of vault configurations with descriptions and paths

### Vault Operations

3. **`get_notes`**
   - List notes in vault folder
   - Inputs: `vaultId`, `folder` (optional)
   - Returns: Array of note file paths within the specified vault folder
