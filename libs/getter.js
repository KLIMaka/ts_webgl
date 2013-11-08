define(["require", "exports"], function(require, exports) {
    function get(fname) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', fname, false);
        xhr.responseType = 'arraybuffer';
        xhr.send();
        return xhr.response;
    }
    exports.get = get;

    function getString(fname) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', fname, false);
        xhr.send();
        return xhr.response;
    }
    exports.getString = getString;
});
