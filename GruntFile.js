module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.initConfig({});

  var modules = [
    'raven',
    'build',
    'duke',
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
    'midi',
    'midi_echo'
  ];

  var nodemodules = [
    'lisp',
    'rff'
  ];

  for (var i = 0; i < modules.length; i++) {
    var module = modules[i];

    grunt.config(['ts', module], {
      src: ['src/' + module + '.ts'],
      dest: 'distr/',
      options: {
        rootDir: 'src/',
        module: 'es2015',
        target: 'es6',
        lib: ['es2015', 'dom'],
      }
    });
    grunt.config(['watch', module], {
      files: '**/*.ts',
      tasks: ['ts:' + module]
    });

    grunt.registerTask(module, ['ts:' + module]);
    grunt.registerTask('watch_' + module, ['watch:' + module]);
  }

  for (var i = 0; i < nodemodules.length; i++) {
    var module = nodemodules[i];

    grunt.config(['ts', module], {
      src: ['src/' + module + '.ts'],
      dest: 'node_distr/',
      options: {
        rootDir: 'src/',
        module: 'commonjs'
      }
    });
    grunt.config(['watch', module], {
      files: '**/*.ts',
      tasks: ['ts:' + module]
    });
    grunt.registerTask(module, ['ts:' + module]);
    grunt.registerTask('watch_' + module, ['watch:' + module]);
  }
}