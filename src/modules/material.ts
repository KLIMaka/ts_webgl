import Shader = require('shader');
import Textures = require('textures');

export interface Material {
  getShader():Shader.Shader;
  getTexture(sampler:string):Textures.Texture;
}

export class SimpleMaterial implements Material {
  constructor(private shader:Shader.Shader, private textures:{[index:string]:Textures.Texture}) {}
  getShader():Shader.Shader {return this.shader}
  getTexture(sampler:string):Textures.Texture {return this.textures[sampler]}
}