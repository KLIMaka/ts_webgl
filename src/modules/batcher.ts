import * as DS from './drawstruct';

export function clear(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  gl.clearColor(data[0], data[1], data[2], data[3]);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return shader;
}

export function shader(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  var shader = <DS.Shader>data;
  gl.useProgram(shader.getProgram());
  return shader;
}

export function vertexBuffers(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  if (shader == null)
    throw new Error('Attempt to set buffers wo shader');
  var attributes = shader.getAttributes();
  for (var a in attributes) {
    var attr = attributes[a];
    var buf = data[attr.getName()];
    if (buf == undefined)
      throw new Error('No buffer for shader attribute <' + attr + '>');
    var location = shader.getAttributeLocation(attr.getName(), gl);
    if (location == -1)
      continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
  }
  return shader;
}

export function indexBuffer(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, (<DS.IndexBuffer>data).getBuffer());
  return shader;
}

export function drawCall(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  gl.drawElements(data[0], data[1], gl.UNSIGNED_SHORT, data[2]);
  return shader;
}

export var setters = {
  mat4 : (gl:WebGLRenderingContext, loc, val) => gl.uniformMatrix4fv(loc, false, val),
  int2 : (gl:WebGLRenderingContext, loc, val) => gl.uniform2iv(loc, val),
  vec2 : (gl:WebGLRenderingContext, loc, val) => gl.uniform2fv(loc, val),
  vec3 : (gl:WebGLRenderingContext, loc, val) => gl.uniform3fv(loc, val),
  vec4 : (gl:WebGLRenderingContext, loc, val) => gl.uniform4fv(loc, val),
  int1 : (gl:WebGLRenderingContext, loc, val) => gl.uniform1i(loc, val),
  flt1 : (gl:WebGLRenderingContext, loc, val) => gl.uniform1f(loc, val)
}

export function uniforms(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  for (var i = 0; i < data.length; i+=3) {
    var name = data[i];
    var setter = data[i+1];
    var val = data[i+2];
    var loc = shader.getUniformLocation(name, gl);
    if (!loc)
      continue;
    setter(gl, loc, val instanceof Function ? val() : val);
  }
  return shader;
}

export function sampler(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  var unit = data[0];
  var sampler = data[1];
  var tex = data[2];
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.uniform1i(shader.getUniformLocation(sampler, gl), unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  return shader;
}

export function exec(cmds:any[], gl:WebGLRenderingContext):void {
  var shader:DS.Shader = null;
  for (var i = 0 ; i < cmds.length; i+=2) {
    var f = cmds[i];
    var args = cmds[i+1];
    shader = f(gl, shader, args instanceof Function ? args() : args);
  }
}
