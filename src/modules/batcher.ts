import DS = require('drawstruct');

export interface Command {
  type():string;
};

export class VertexBuffers implements Command {
  get(attr:string):DS.VertexBuffer {throw new Error()}
  type():string {return "VertexBuffers"}
}

export class IndexBuffer implements Command {
  get():DS.IndexBuffer {throw new Error();}
  type():string {return "IndexBuffer"}
}

export class Shader implements Command {
  get():DS.Shader {throw new Error()}
  type():string {return "Shader"}
}

export class Uniforms implements Command {
  bind(shader:DS.Shader, gl:WebGLRenderingContext):void {throw new Error()}
  type():string {return "Uniforms"}
}

export class State implements Command {
  apply(gl:WebGLRenderingContext):void {throw new Error()}
  type():string {return "State"}
}

export class DrawCall implements Command {
  call(gl:WebGLRenderingContext):void {throw new Error()}
  type():string {return "DrawCall"}
}

export class BatchState {
  private shader:Shader;
  private vtxBuffers:VertexBuffers;
  private idxBuffer:IndexBuffer;
  private uniforms:Uniforms;

  public exec(cmds:Command[], gl:WebGLRenderingContext):void {
    for (var i = 0; i < cmds.length; i++) {
      var cmd = cmds[i];
      if (cmd.type() == 'Shader')
        this.setShader(<Shader>cmd, gl);
      else if (cmd.type() == 'VertexBuffers')
        this.setVertexBuffers(<VertexBuffers>cmd, gl);
      else if (cmd.type() == 'IndexBuffer')
        this.setIndexBuffer(<IndexBuffer>cmd, gl);
      else if (cmd.type() == 'Uniforms')
        this.setUniforms(<Uniforms>cmd, gl);
      else if (cmd.type() == 'State') 
        (<State>cmd).apply(gl);
      else if (cmd.type() == 'DrawCall')
        (<DrawCall>cmd).call(gl);
      else 
        throw new Error("Unknown command");
    }
  }

  private setShader(shader:Shader, gl:WebGLRenderingContext):void {
    this.shader = shader;
    gl.useProgram(shader.get().getProgram());
    if (this.vtxBuffers != null)
      this.setVertexBuffers(this.vtxBuffers, gl);
    if (this.idxBuffer != null)
      this.setIndexBuffer(this.idxBuffer, gl);
    if (this.uniforms != null)
      this.setUniforms(this.uniforms, gl);
  }

  private setVertexBuffers(buffers:VertexBuffers, gl:WebGLRenderingContext):void {
    if (this.shader == null)
      throw new Error('Attempt to set buffers wo shader');
    this.vtxBuffers = buffers;
    var shader = this.shader.get();
    var attributes = shader.getAttributes();
    for (var a = 0; a < attributes.length; a++) {
      var attr = attributes[a];
      var buf = buffers.get(attr);
      if (buf == undefined)
        throw new Error('No buffer for shader attribute <' + attr + '>');
      var location = shader.getAttributeLocation(attr, gl);
      if (location == -1)
        continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
    }
  }

  private setIndexBuffer(buffer:IndexBuffer, gl:WebGLRenderingContext):void {
    this.idxBuffer = buffer;
    var idxBuf = buffer.get();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
  }

  private setUniforms(uniforms:Uniforms, gl:WebGLRenderingContext):void {
    if (this.shader == null)
      throw new Error('Attempt to set uniforms wo shader');
    this.uniforms = uniforms;
    uniforms.bind(this.shader.get(), gl);
  }
}