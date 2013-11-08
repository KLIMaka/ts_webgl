define(["require", "exports"], function(require, exports) {
    var Pool = (function () {
        function Pool(maxsize, allocator) {
            this.top = 0;
            this.maxsize = maxsize;
            this.pool = new Array(maxsize);
            this.allocator = allocator;
        }
        Pool.prototype.get = function () {
            if (this.top == this.maxsize)
                throw new Error("Pool owerflow");
            if (this.pool[this.top] == undefined)
                this.pool[this.top] = this.allocator();
            return this.pool[this.top++];
        };

        Pool.prototype.ret = function () {
            var vals = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                vals[_i] = arguments[_i + 0];
            }
            if (this.top - vals.length < 0)
                throw new Error("Pool underflow");
            this.top -= vals.length;
        };
        return Pool;
    })();
    exports.Pool = Pool;
});
//# sourceMappingURL=pool.js.map
