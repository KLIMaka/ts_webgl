module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.initConfig({});

  var modules = [
    'raven',
    'buid',
    'anvil'
  ];

  for (var i = 0; i < modules.length; i++) {
    var module = modules[i];

    grunt.config(['typescript', module], {
      src: ['src/' + module + '.js'],
      dest: 'distr/',
      options: {
        buildPath: 'src/',
        module: 'amd'
      }
    });
    grunt.config(['watch', module], {
      files: '**/*.ts',
      tasks: ['typescript:' + module]
    });

    grunt.registerTask(module, ['typescript:' + module]);
  }
}