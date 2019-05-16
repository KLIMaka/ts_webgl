
export interface VertexBuffer {
  getBuffer(): WebGLBuffer;
  getType(): number;
  getSpacing(): number;
  getNormalized(): boolean;
  getStride(): number;
  getOffset(): number;
}

export interface IndexBuffer {
  getBuffer(): WebGLBuffer;
  getType(): number;
}

export interface Texture {
  get():WebGLTexture;
  getWidth():number;
  getHeight():number;
  getFormat():number;
  getType():number;
}

export interface Shader {
  getUniformLocation(name:string, gl:WebGLRenderingContext):WebGLUniformLocation;
  getAttributeLocation(name:string, gl:WebGLRenderingContext):number;
  getProgram():WebGLProgram;
  getUniforms():{[index:string]:Definition};
  getAttributes():{[index:string]:Definition};
  getSamplers():{[index:string]:Definition};
}

export interface Definition {
   getName():string;
   getType():string;
}

export interface Material {
  getShader():Shader;
  getTexture(sampler:string):Texture;
}


export interface DrawStruct {
  getMaterial():Material;
  getMode(): number;
  getVertexBuffer(attribute:string): VertexBuffer;
  getVertexBuffers(): VertexBuffer[];
  getAttributes(): string[];
  getIndexBuffer(): IndexBuffer;
  getLength(): number;
  getOffset(): number;
}