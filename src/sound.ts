import S = require('./libs_js/jsfx');
import GLU = require('./libs_js/glutess');
import IU = require('./libs/imgutils');
var jsfx = S.jsfx;

var wave = jsfx.createWave(["square",0.0000,0.4000,0.1100,0.6400,0.0450,0.9040,1960.0000,666.0000,1882.0000,-0.0200,-0.7260,0.9560,16.9025,-0.1726,-0.3200,-0.6140,0.8410,0.4215,0.0040,0.3784,0.2240,-0.0060,0.9350,0.5240,0.2630,0.3960,-0.7220]);
wave.play();

var tess = GLU.tesselate([/*[16896,24064,16896,23040,14848,23040,17408,17408],*/[17408,25600,14336,25600,14336,17408,14848,19968]/*,[16896,19968,16896,18944,14848,18944,14848,24064]*/]);
console.log(tess);
var canvas = IU.createEmptyCanvas(1000, 1000);
var ctx = canvas.getContext('2d');
ctx.fillStyle = '#000';
for (var i = 0; i < tess.length; i+=3) {
	ctx.beginPath();
	ctx.moveTo(tess[i][0]/100, tess[i][1]/100);
	ctx.lineTo(tess[i+1][0]/100, tess[i+1][1]/100);
	ctx.lineTo(tess[i+2][0]/100, tess[i+2][1]/100);
	ctx.closePath();
	ctx.fill();
}

document.body.appendChild(canvas);
