/// <reference path="../defs/webgl.d.ts" />
define(["require", "exports"], function(require, exports) {
    var Shader = (function () {
        function Shader(prog) {
            this.uniforms = {};
            this.attribs = {};
            this.program = prog;
        }
        Shader.prototype.getUniformLocation = function (name, gl) {
            var location = this.uniforms[name];
            if (location == undefined) {
                location = gl.getUniformLocation(this.program, name);
                this.uniforms[name] = location;
            }
            return location;
        };

        Shader.prototype.getAttributeLocation = function (name, gl) {
            var location = this.attribs[name];
            if (location == undefined) {
                location = gl.getAttribLocation(this.program, name);
                this.attribs[name] = location;
            }
            return location;
        };

        Shader.prototype.getProgram = function () {
            return this.program;
        };
        return Shader;
    })();
    exports.Shader = Shader;

    function createShader(gl, vertexSrc, fragmentSrc) {
        function compileSource(type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw 'compile error: ' + gl.getShaderInfoLog(shader);
            }
            return shader;
        }

        var program = gl.createProgram();
        gl.attachShader(program, compileSource(gl.VERTEX_SHADER, vertexSrc));
        gl.attachShader(program, compileSource(gl.FRAGMENT_SHADER, fragmentSrc));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw 'link error: ' + gl.getProgramInfoLog(program);
        }

        return new Shader(program);
    }
    exports.createShader = createShader;
});
