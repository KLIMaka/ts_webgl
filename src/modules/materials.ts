import DS = require('drawstruct');

export class SimpleMaterial implements DS.Material {
  constructor(private shader:DS.Shader, private textures:{[index:string]:DS.Texture}) {}
  getShader():DS.Shader {return this.shader}
  getTexture(sampler:string):DS.Texture {return this.textures[sampler]}
}