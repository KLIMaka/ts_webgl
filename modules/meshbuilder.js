/// <reference path="../defs/webgl.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports"], function(require, exports) {
    var VertexBufferImpl = (function () {
        function VertexBufferImpl(buffer, type) {
            this.buffer = buffer;
            this.type = type;
        }
        VertexBufferImpl.prototype.getBuffer = function () {
            return this.buffer;
        };

        VertexBufferImpl.prototype.getType = function () {
            return this.type;
        };

        VertexBufferImpl.prototype.getSpacing = function () {
            return 3;
        };

        VertexBufferImpl.prototype.getNormalized = function () {
            return false;
        };

        VertexBufferImpl.prototype.getStride = function () {
            return 0;
        };

        VertexBufferImpl.prototype.getOffset = function () {
            return 0;
        };
        return VertexBufferImpl;
    })();

    var VertexBufferImplLine = (function (_super) {
        __extends(VertexBufferImplLine, _super);
        function VertexBufferImplLine(buffer, type) {
            _super.call(this, buffer, type);
        }
        VertexBufferImplLine.prototype.getSpacing = function () {
            return 2;
        };
        return VertexBufferImplLine;
    })(VertexBufferImpl);

    var IndexBufferImpl = (function () {
        function IndexBufferImpl(buffer, type) {
            this.buffer = buffer;
            this.type = type;
        }
        IndexBufferImpl.prototype.getBuffer = function () {
            return this.buffer;
        };

        IndexBufferImpl.prototype.getType = function () {
            return this.type;
        };
        return IndexBufferImpl;
    })();

    var Mesh = (function () {
        function Mesh(pos, idx, mode, length) {
            this.attributes = ['pos'];
            this.pos = pos;
            this.idx = idx;
            this.mode = mode;
            this.length = length;
        }
        Mesh.prototype.getMode = function () {
            return this.mode;
        };

        Mesh.prototype.getVertexBuffer = function (attribute) {
            return this.pos;
        };

        Mesh.prototype.getAttributes = function () {
            return this.attributes;
        };

        Mesh.prototype.getIndexBuffer = function () {
            return this.idx;
        };

        Mesh.prototype.getLength = function () {
            return this.length;
        };

        Mesh.prototype.getOffset = function () {
            return 0;
        };
        return Mesh;
    })();
    exports.Mesh = Mesh;

    var WireBuilder = (function () {
        function WireBuilder() {
            this.points = [];
            this.indices = [];
            this.lasIndex = 0;
        }
        WireBuilder.prototype.addVertex = function (vtx) {
            this.points.push(vtx[0], vtx[1]);
        };

        WireBuilder.prototype.addLine = function (start, end) {
            this.addVertex(start);
            this.addVertex(end);
            var idx = this.lasIndex;
            this.indices.push(idx, idx + 1);
            this.lasIndex += 2;
        };

        WireBuilder.prototype.build = function (gl) {
            var posBuffer = gl.createBuffer();
            var posData = new Float32Array(this.points);
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, posData, gl.STATIC_DRAW);
            var pos = new VertexBufferImplLine(posBuffer, gl.FLOAT);

            var idxBuffer = gl.createBuffer();
            var idxData = new Uint16Array(this.indices);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
            var idx = new IndexBufferImpl(idxBuffer, gl.UNSIGNED_SHORT);

            return new Mesh(pos, idx, gl.LINES, idxData.length);
        };
        return WireBuilder;
    })();
    exports.WireBuilder = WireBuilder;

    var MeshBuilder = (function () {
        function MeshBuilder() {
            this.positions = [];
            this.indices = [];
            this.lastIdx = 0;
        }
        MeshBuilder.prototype.addVertex = function (vtx) {
            this.positions.push(vtx[0]);
            this.positions.push(vtx[1]);
            this.positions.push(vtx[2]);
        };

        MeshBuilder.prototype.addTriangle = function (verts) {
            this.addVertex(verts[0]);
            this.addVertex(verts[1]);
            this.addVertex(verts[2]);
            var idx = this.lastIdx;
            this.indices.push(idx, idx + 1, idx + 2);
            this.lastIdx += 3;
        };

        MeshBuilder.prototype.addQuad = function (verts) {
            this.addVertex(verts[0]);
            this.addVertex(verts[1]);
            this.addVertex(verts[2]);
            this.addVertex(verts[3]);
            var idx = this.lastIdx;
            this.indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
            this.lastIdx += 4;
        };

        MeshBuilder.prototype.build = function (gl) {
            var posBuffer = gl.createBuffer();
            var posData = new Float32Array(this.positions);
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, posData, gl.STATIC_DRAW);
            var pos = new VertexBufferImpl(posBuffer, gl.FLOAT);

            var idxBuffer = gl.createBuffer();
            var idxData = new Uint16Array(this.indices);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
            var idx = new IndexBufferImpl(idxBuffer, gl.UNSIGNED_SHORT);

            return new Mesh(pos, idx, gl.TRIANGLES, idxData.length);
        };
        return MeshBuilder;
    })();
    exports.MeshBuilder = MeshBuilder;
});
