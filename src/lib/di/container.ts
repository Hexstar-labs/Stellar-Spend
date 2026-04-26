/**
 * Dependency Injection Container
 * Lightweight DI framework for managing service dependencies
 */

export type ServiceFactory<T> = () => T | Promise<T>;
export type ServiceProvider<T> = T | ServiceFactory<T>;

export interface DIContainerConfig {
  singletons?: boolean;
}

export class DIContainer {
  private services: Map<string | symbol, ServiceProvider<any>> = new Map();
  private instances: Map<string | symbol, any> = new Map();
  private config: DIContainerConfig;

  constructor(config: DIContainerConfig = { singletons: true }) {
    this.config = config;
  }

  /**
   * Register a service or factory
   */
  register<T>(key: string | symbol, provider: ServiceProvider<T>): void {
    this.services.set(key, provider);
    if (!this.config.singletons) {
      this.instances.delete(key);
    }
  }

  /**
   * Register a singleton instance
   */
  registerSingleton<T>(key: string | symbol, instance: T): void {
    this.services.set(key, instance);
    this.instances.set(key, instance);
  }

  /**
   * Resolve a service
   */
  async resolve<T>(key: string | symbol): Promise<T> {
    // Return cached instance if singleton
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    const provider = this.services.get(key);
    if (!provider) {
      throw new Error(`Service not found: ${String(key)}`);
    }

    let instance: T;
    if (typeof provider === 'function') {
      instance = await provider();
    } else {
      instance = provider as T;
    }

    // Cache if singleton
    if (this.config.singletons) {
      this.instances.set(key, instance);
    }

    return instance;
  }

  /**
   * Resolve synchronously (for non-async factories)
   */
  resolveSync<T>(key: string | symbol): T {
    // Return cached instance if singleton
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    const provider = this.services.get(key);
    if (!provider) {
      throw new Error(`Service not found: ${String(key)}`);
    }

    let instance: T;
    if (typeof provider === 'function') {
      const result = (provider as any)();
      if (result instanceof Promise) {
        throw new Error(`Cannot resolve async service synchronously: ${String(key)}`);
      }
      instance = result;
    } else {
      instance = provider as T;
    }

    // Cache if singleton
    if (this.config.singletons) {
      this.instances.set(key, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(key: string | symbol): boolean {
    return this.services.has(key);
  }

  /**
   * Clear all services and instances
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
  }
}

// Global DI container instance
export const globalContainer = new DIContainer();
