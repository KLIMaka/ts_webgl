
export class Type<T> { constructor(readonly name: string) { } }

export type InstanceProvider<T> = (injector: Injector) => T;

export class Injector {
  private providers = new Map<Type<any>, InstanceProvider<any>>();
  private instances = new Map<Type<any>, any>();

  public getInstance<T>(type: Type<T>): T {
    let instance = this.instances.get(type);
    if (instance == undefined) {
      instance = this.create(type);
      this.instances.set(type, instance);
    }
    return instance;
  }

  public bind<T>(type: Type<T>, provider: InstanceProvider<T>) {
    this.providers.set(type, provider);
  }

  public bindInstance<T>(type: Type<T>, instance: T) {
    this.instances.set(type, instance);
  }

  public install(module: (injector: Injector) => void) {
    module(this);
  }

  private create<T>(type: Type<T>): T {
    const provider = this.providers.get(type);
    if (provider == null) throw new Error(`No provider bound to ${type.name}`);
    return provider(this);
  }
}

export const INJECTOR = new Injector();