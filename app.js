/// <reference path="defs/webgl.d.ts"/>
define(["require", "exports", './modules/shader', './modules/meshbuilder', './modules/buildloader', './libs/dataviewstream', './libs/getter', './modules/controller2d'], function(require, exports, __shaders__, __mb__, __build__, __data__, __getter__, __controller__) {
    var shaders = __shaders__;
    var mb = __mb__;
    
    var build = __build__;
    
    var data = __data__;
    var getter = __getter__;
    var controller = __controller__;
    

    var w = 800;
    var h = 600;

    function setupGl() {
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var gl = canvas.getContext('webgl', { antialias: true });

        document.body.appendChild(gl.canvas);
        document.body.style.overflow = 'hidden';
        gl.canvas.style.position = 'absolute';
        return gl;
    }

    function animate(gl, callback) {
        var time = new Date().getTime();

        function update() {
            var now = new Date().getTime();
            callback(gl, (now - time) / 1000);
            requestAnimationFrame(update);
            time = now;
        }

        update();
    }
    ;

    function load(file) {
        return getter.getString(file);
    }

    var gl = setupGl();

    var board = build.loadBuildMap(new data.DataViewStream(getter.get('./tests/RCPD.map'), true));

    var maxsector;
    var maxsectorwalls = 0;
    var sectors = board.sectors;
    for (var i = 0; i < sectors.length; i++) {
        var sec = sectors[i];
        if (sec.wallnum > maxsectorwalls) {
            maxsector = sec;
            maxsectorwalls = sec.wallnum;
        }
    }

    function getContourAndHoles(sector, walls) {
        var i = 0;
        var pairs = [];
        while (i < sector.wallnum) {
            var firstwallIdx = i + sector.wallptr;
            var wall = walls[sector.wallptr + i];
            while (wall.point2 != firstwallIdx) {
                wall = walls[wall.point2];
                i++;
            }
            pairs.push([firstwallIdx, sector.wallptr + i]);
        }

        var holes = [];
        for (var i = 0; i < pairs.length - 1; i++) {
            var hole = [];
            var pair = pairs[i];
            for (var j = pair[0]; j < pair[1] + 1; j++) {
                hole.push([walls[j].x, walls[j].y]);
            }
            holes.push(hole);
        }
        var contour = [];
        var lastpair = pairs[pair.length - 1];
        for (var k = lastpair[0]; k < lastpair[1] + 1; k++) {
            contour.push([walls[k].x, walls[k].y]);
        }
        return { contour: contour, holes: holes };
    }

    var builder = new mb.WireBuilder();
    var walls = board.walls;
    console.log(getContourAndHoles(maxsector, walls));
    for (var i = maxsector.wallptr; i < maxsector.wallptr + maxsector.wallnum; i++) {
        var wall = walls[i];
        var nwall = walls[wall.point2];
        builder.addLine([wall.x, wall.y], [nwall.x, nwall.y]);
    }
    console.log('parsed ' + maxsector.wallnum + ' walls');

    var model = builder.build(gl);
    var shader = shaders.createShader(gl, load('shaders/s.vsh'), load('shaders/s.fsh'));
    var control = new controller.Controller2D(gl);
    control.setUnitsPerPixel(100);

    function draw(gl, model, shader) {
        var attributes = model.getAttributes();
        for (var i in attributes) {
            var attr = attributes[i];
            var buf = model.getVertexBuffer(attr);
            var location = shader.getAttributeLocation(attr, gl);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
        }

        if (model.getIndexBuffer() == null) {
            gl.drawArrays(model.getMode(), model.getOffset(), model.getLength());
        } else {
            var idxBuf = model.getIndexBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
            gl.drawElements(model.getMode(), model.getLength(), idxBuf.getType(), model.getOffset());
        }
    }

    animate(gl, function (gl, time) {
        gl.clearColor(0.1, 0.3, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(shader.getProgram());
        gl.uniformMatrix4fv(shader.getUniformLocation('MVP', gl), false, control.getMatrix());

        draw(gl, model, shader);
    });

    gl.canvas.oncontextmenu = function () {
        return false;
    };
});
