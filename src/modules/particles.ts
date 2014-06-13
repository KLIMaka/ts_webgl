
import L = require('./list');

export class Particle {
  public x:number;
  public y:number;
  public vx:number;
  public vy:number;
  public size:number;
  public visible:boolean = false;
  public ttl:number;
  public alpha:number;
}

export class ParticleSystem {

  private pool:L.List<Particle> = new L.List<Particle>();
  private active:L.List<Particle> = new L.List<Particle>(); 
  private count:number;

  constructor(n:number, private initf:any, private updatef:any, private dief:any) {
    this.count = n;
    this.createPool(n);
  }

  private createPool(n:number) {
    for (var i = 0; i < n; i++) {
      this.pool.insertAfter(new Particle());
    }
  }

  public update(dt:number):void {
    if (dt == 0)
      return;

    var node = this.active.first();
    var term = this.active.last().next;
    while (node != term) {
      var p = node.obj;

      p.ttl -= dt;
      if (p.ttl <= 0) {
        var remove = this.dief(p);
        if (remove) {
          var next = node.next;
          this.pool.insertNodeAfter(this.active.remove(node));
          node = next;
        }
        continue;
      }
      this.updatef(p, dt);
      node = node.next;
    }
  }

  public getParticles():L.List<Particle> {
    return this.active;
  }

  public emit():void {
    if (this.pool.isEmpty())
      return;
    var node = this.pool.remove(this.pool.last());
    this.initf(node.obj);
    this.active.insertNodeAfter(node);
  }

}