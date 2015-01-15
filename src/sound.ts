import S = require('./libs_js/jsfx');
import GLU = require('./libs_js/glutess');
var jsfx = S.jsfx;

var wave = jsfx.createWave(["square",0.0000,0.4000,0.1100,0.6400,0.0450,0.9040,1960.0000,666.0000,1882.0000,-0.0200,-0.7260,0.9560,16.9025,-0.1726,-0.3200,-0.6140,0.8410,0.4215,0.0040,0.3784,0.2240,-0.0060,0.9350,0.5240,0.2630,0.3960,-0.7220]);
wave.play();

GLU.beginPolygon();
GLU.beginContour();
GLU.vertices(new Float32Array([-1,3,0,0,0,0,1,3,0,0,2,0]));
GLU.endContour();
GLU.endPolygon();