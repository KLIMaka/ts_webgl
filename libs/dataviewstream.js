define(["require", "exports"], function(require, exports) {
    var DataViewStream = (function () {
        function DataViewStream(buf, isLE) {
            this.view = new DataView(buf);
            this.offset = 0;
            this.littleEndian = isLE;
        }
        DataViewStream.prototype.setOffset = function (off) {
            this.offset = off;
        };

        DataViewStream.prototype.readByte = function () {
            return this.view.getInt8(this.offset++);
        };

        DataViewStream.prototype.readUByte = function () {
            return this.view.getUint8(this.offset++);
        };

        DataViewStream.prototype.readShort = function () {
            var ret = this.view.getInt16(this.offset, this.littleEndian);
            this.offset += 2;
            return ret;
        };

        DataViewStream.prototype.readUShort = function () {
            var ret = this.view.getUint16(this.offset, this.littleEndian);
            this.offset += 2;
            return ret;
        };

        DataViewStream.prototype.readInt = function () {
            var ret = this.view.getInt32(this.offset, this.littleEndian);
            this.offset += 4;
            return ret;
        };

        DataViewStream.prototype.readUInt = function () {
            var ret = this.view.getUint32(this.offset, this.littleEndian);
            this.offset += 4;
            return ret;
        };

        DataViewStream.prototype.readFloat = function () {
            var ret = this.view.getFloat32(this.offset, this.littleEndian);
            this.offset += 4;
            return ret;
        };

        DataViewStream.prototype.readByteString = function (len) {
            var str = new Array(len);
            for (var i = 0; i < len; i++) {
                str[i] = String.fromCharCode(this.readByte());
            }
            return str.join('');
        };

        DataViewStream.prototype.subView = function () {
            var ret = new DataViewStream(this.view.buffer, this.littleEndian);
            ret.setOffset(this.offset);
            return ret;
        };
        return DataViewStream;
    })();
    exports.DataViewStream = DataViewStream;
});
