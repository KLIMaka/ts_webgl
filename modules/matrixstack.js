define(["require", "exports", './../libs/glmatrix'], function(require, exports, __GLM__) {
    var GLM = __GLM__;

    var MatrixStack = (function () {
        function MatrixStack() {
            this.MAX_DEPTH = 1024;
            this.top = 0;
            this.stack = new Array(this.MAX_DEPTH);
            this.stack[this.top] = GLM.mat4.create();
            this.loadIdentity();
        }
        MatrixStack.prototype.loadIdentity = function () {
            GLM.mat4.identity(this.stack[this.top]);
        };

        MatrixStack.prototype.push = function () {
            if (this.top == this.MAX_DEPTH)
                throw new Error("Matrix stack owerflow");
            this.top++;
            if (this.stack[this.top] == undefined)
                this.stack[this.top] = GLM.mat4.create();
            this.loadIdentity();
        };

        MatrixStack.prototype.pop = function () {
            if (this.top == this.MAX_DEPTH)
                throw new Error("Matrix stack underflow");
            this.top--;
        };

        MatrixStack.prototype.translate = function (vec) {
            var curr = this.stack[this.top];
            GLM.mat4.translate(curr, curr, vec);
        };

        MatrixStack.prototype.scale = function (vec) {
            var curr = this.stack[this.top];
            GLM.mat4.scale(curr, curr, vec);
        };

        MatrixStack.prototype.rotateX = function (rad) {
            var curr = this.stack[this.top];
            GLM.mat4.rotateX(curr, curr, rad);
        };

        MatrixStack.prototype.rotateY = function (rad) {
            var curr = this.stack[this.top];
            GLM.mat4.rotateY(curr, curr, rad);
        };

        MatrixStack.prototype.rotateZ = function (rad) {
            var curr = this.stack[this.top];
            GLM.mat4.rotateZ(curr, curr, rad);
        };

        MatrixStack.prototype.mul = function (mat) {
            var curr = this.stack[this.top];
            GLM.mat4.mul(curr, curr, mat);
        };
        return MatrixStack;
    })();
    exports.MatrixStack = MatrixStack;
});
//# sourceMappingURL=matrixstack.js.map
