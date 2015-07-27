import DS = require('drawstruct');

export function shader(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  var shader = <DS.Shader>data;
  gl.useProgram(shader.getProgram());
  return shader;
}

export function vertexBuffers(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  if (shader == null)
    throw new Error('Attempt to set buffers wo shader');
  var attributes = shader.getAttributes();
  for (var a = 0; a < attributes.length; a++) {
    var attr = attributes[a];
    var buf = data[attr];
    if (buf == undefined)
      throw new Error('No buffer for shader attribute <' + attr + '>');
    var location = shader.getAttributeLocation(attr, gl);
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
  mat4 : (gl, loc, val) => gl.uniformMatrix4fv(loc, false, val),
  vec3 : (gl, loc, val) => gl.uniform3fv(loc, val),
  vec4 : (gl, loc, val) => gl.uniform4fv(loc, val),
  int1 : (gl, loc, val) => gl.uniform1i(loc, val),
  flt1 : (gl, loc, val) => gl.uniform1f(loc, val)
}

export function uniforms(gl:WebGLRenderingContext, shader:DS.Shader, data:any):DS.Shader {
  for (var i = 0; i < data.length; i+=3) {
    var name = data[i];
    var setter = data[i+1];
    var val = data[i+2];
    var loc = shader.getUniformLocation(name, gl);
    if (!loc)
      continue;
    setter(gl, loc, val);
  }
  return shader;
}

export function exec(cmds:any[], gl:WebGLRenderingContext):void {
  var shader:DS.Shader = null;
  for (var i = 0 ; i < cmds.length; i+=2) {
    var f = cmds[i];
    var args = cmds[i+1];
    shader = f(gl, shader, args);
  }
}
