
export class Dependency<T> { constructor(readonly name: string) { } }

export type InstanceProvider<T> = (injector: Injector) => Promise<T>;

export class Injector {
  private providers = new Map<Dependency<any>, InstanceProvider<any>>();
  private instances = new Map<Dependency<any>, Promise<any>>();

  public getInstance<T>(dependency: Dependency<T>): Promise<T> {
    let instance = this.instances.get(dependency);
    if (instance == undefined) {
      instance = this.create(dependency);
      this.instances.set(dependency, instance);
    }
    return instance;
  }

  public bind<T>(dependency: Dependency<T>, provider: InstanceProvider<T>) {
    this.providers.set(dependency, provider);
  }

  public bindInstance<T>(dependency: Dependency<T>, instance: Promise<T>) {
    this.instances.set(dependency, instance);
  }

  public install(module: (injector: Injector) => void) {
    module(this);
  }

  private async create<T>(dependency: Dependency<T>): Promise<T> {
    const provider = this.providers.get(dependency);
    if (provider == null) throw new Error(`No provider bound to ${dependency.name}`);
    return provider(this);
  }
}