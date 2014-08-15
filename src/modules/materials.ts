import DS = require('drawstruct');

export class SimpleMaterial implements DS.Material {
  constructor(private shader:DS.Shader, private textures:{[index:string]:DS.Texture}) {}
  getShader():DS.Shader {return this.shader}
  getTexture(sampler:string):DS.Texture {return this.textures[sampler]}
}

export class SelectionMaterial implements DS.Material {
  private selectMode = false;
  constructor(private shader:DS.Shader, private selectShader:DS.Shader, private textures:{[index:string]:DS.Texture}) {}
  getShader():DS.Shader {return this.selectMode ? this.selectShader : this.shader}
  getTexture(sampler:string):DS.Texture {return this.textures[sampler]}
  setSelection(mode:boolean) {this.selectMode = mode}
}