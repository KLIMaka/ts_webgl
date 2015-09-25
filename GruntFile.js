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
    'paint'
  ];

  var nodemodules = [
    'rff'
  ];

  for (var i = 0; i < modules.length; i++) {
    var module = modules[i];

    grunt.config(['typescript', module], {
      src: ['src/' + module + '.ts'],
      dest: 'distr/',
      options: {
        basePath: 'src/',
        module: 'amd'
      }
    });
    grunt.config(['watch', module], {
      files: '**/*.ts',
      tasks: ['typescript:' + module]
    });

    grunt.registerTask(module, ['typescript:' + module]);
  }

  for (var i = 0; i < nodemodules.length; i++) {
    var module = nodemodules[i];

    grunt.config(['typescript', module], {
      src: ['src/' + module + '.ts'],
      dest: 'node_distr/',
      options: {
        basePath: 'src/',
        module: 'commonjs'
      }
    });
    grunt.registerTask(module, ['typescript:' + module]);
  }
}