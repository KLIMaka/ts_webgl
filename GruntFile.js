module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.initConfig({});

  var modules = [
    'raven',
    'build',
    'anvil',
    'wl',
    'sound',
    'grp',
    'particles',
    'particles_gl',
    'hmm2',
    'hmm_bin',
    'app1',
    'ui',
    'paint',
    'console',
    'tilerenderer',
    'rasterizer',
    'psx',
    'gl_test',
    'mapper',
    'sketch',
    'parser',
    'midi'
  ];

  var nodemodules = [
    'lisp',
    'rff'
  ];

  for (var i = 0; i < modules.length; i++) {
    var module = modules[i];

    grunt.config(['typescript', module], {
      src: ['src/' + module + '.ts'],
      dest: 'distr/',
      options: {
        rootDir: 'src/',
        module: 'amd',
        target: 'es6'
      }
    });
    grunt.config(['watch', module], {
      files: '**/*.ts',
      tasks: ['typescript:' + module]
    });

    grunt.registerTask(module, ['typescript:' + module]);
    grunt.registerTask('watch_' + module, ['watch:' + module]);
  }

  for (var i = 0; i < nodemodules.length; i++) {
    var module = nodemodules[i];

    grunt.config(['typescript', module], {
      src: ['src/' + module + '.ts'],
      dest: 'node_distr/',
      options: {
        rootDir: 'src/',
        module: 'commonjs'
      }
    });
    grunt.config(['watch', module], {
      files: '**/*.ts',
      tasks: ['typescript:' + module]
    });
    grunt.registerTask(module, ['typescript:' + module]);
    grunt.registerTask('watch_' + module, ['watch:' + module]);
  }
}