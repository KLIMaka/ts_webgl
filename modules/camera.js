define(["require", "exports", './../libs/glmatrix', './../libs/mathutils'], function(require, exports, __GLM__, __MU__) {
    var GLM = __GLM__;
    var MU = __MU__;

    var Camera = (function () {
        function Camera(x, y, z, ax, ay) {
            this.needUpdate = true;
            this.transform = GLM.mat4.create();
            this.pos = GLM.vec3.fromValues(x, y, z);
            this.angleX = ax;
            this.angleY = ay;
        }
        Camera.prototype.setPos = function (pos) {
            this.pos = pos;
            this.needUpdate = true;
        };

        Camera.prototype.setPosXYZ = function (x, y, z) {
            GLM.vec3.set(this.pos, x, y, z);
            this.needUpdate = true;
        };

        Camera.prototype.getPos = function () {
            return this.pos;
        };

        Camera.prototype.move = function (delta) {
            var tmp = GLM.vec3.transformMat3(GLM.vec3.create(), delta, MU.mat3FromMat4(GLM.mat3.create(), this.getTransformMatrix()));
            GLM.vec3.add(this.pos, this.pos, tmp);
            this.needUpdate = true;
        };

        Camera.prototype.updateAngles = function (dx, dy) {
            this.angleY -= dx;
            this.angleX -= dy;
            this.angleX = Math.max(-90, Math.min(90, this.angleX));
            this.needUpdate = true;
        };

        Camera.prototype.setAngles = function (ax, ay) {
            this.angleX = ax;
            this.angleY = ay;
            this.needUpdate = true;
        };

        Camera.prototype.getTransformMatrix = function () {
            var mat = this.transform;
            if (this.needUpdate) {
                GLM.mat4.identity(mat);
                GLM.mat4.rotateX(mat, mat, MU.deg2rad(-this.angleX));
                GLM.mat4.rotateY(mat, mat, MU.deg2rad(-this.angleY));
                var pos = this.pos;
                GLM.vec3.negate(pos, pos);
                GLM.mat4.translate(mat, mat, pos);
                GLM.vec3.negate(pos, pos);
                this.needUpdate = false;
            }
            return mat;
        };
        return Camera;
    })();
    exports.Camera = Camera;
});
