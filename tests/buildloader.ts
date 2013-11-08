/// <reference path="../defs/nodeunit.d.ts"/>

import build = require('../modules/buildloader');

export function build_test(test:nodeunit.Test) {

  var board = build.loadBuildMap('./newboard.map');
  console.log(board);
//  test.done();
}