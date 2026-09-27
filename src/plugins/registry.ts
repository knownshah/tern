import type { CheckDefinition, TernPlugin } from '../types/index.js';

export class PluginRegistry {
  private plugins = new Map<string, TernPlugin>();
  private customChecks: CheckDefinition[] = [];

  registerPlugin(plugin: TernPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  getPlugin(name: string): TernPlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): TernPlugin[] {
    return Array.from(this.plugins.values());
  }

  registerCheck(check: CheckDefinition): void {
    this.customChecks.push(check);
  }

  getAllChecks(): CheckDefinition[] {
    const checks: CheckDefinition[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.checks) {
        checks.push(...plugin.checks);
      }
    }

    checks.push(...this.customChecks);
    return checks;
  }
}

export const defaultPluginRegistry = new PluginRegistry();
