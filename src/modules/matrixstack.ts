
import GLM = require('./../libs/glmatrix');

export class MatrixStack {

  private MAX_DEPTH:number = 1024;

  private stack:GLM.Mat4Array[];
  private top:number = 0;

  constructor() {
    this.stack = new Array(this.MAX_DEPTH);
    this.stack[this.top] = GLM.mat4.create();
    this.loadIdentity();
  }

  loadIdentity():void {
    GLM.mat4.identity(this.stack[this.top]);
  }

  push():void {
    if (this.top == this.MAX_DEPTH)
      throw new Error("Matrix stack owerflow");
    this.top++;
    if (this.stack[this.top] == undefined)
      this.stack[this.top] = GLM.mat4.create();
    this.loadIdentity();
  }

  pop():void {
    if (this.top == this.MAX_DEPTH)
      throw new Error("Matrix stack underflow");
    this.top--;
  }

  translate(vec:GLM.Vec3Array):void {
    var curr = this.stack[this.top];
    GLM.mat4.translate(curr, curr, vec);
  }

  scale(vec:GLM.Vec3Array):void{
    var curr = this.stack[this.top];
    GLM.mat4.scale(curr, curr, vec);
  }

  rotateX(rad:number):void{
    var curr = this.stack[this.top];
    GLM.mat4.rotateX(curr, curr, rad);
  }

  rotateY(rad:number):void{
    var curr = this.stack[this.top];
    GLM.mat4.rotateY(curr, curr, rad);
  }

  rotateZ(rad:number):void{
    var curr = this.stack[this.top];
    GLM.mat4.rotateZ(curr, curr, rad);
  }

  mul(mat:GLM.Mat4Array) {
    var curr = this.stack[this.top];
    GLM.mat4.mul(curr, curr, mat);
  }
}