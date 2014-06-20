module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    typescript: {
      raven: {
        src: ['src/raven.ts'],
        dest: 'distr/',
        options: {
          basePath: 'src/',
          module: 'amd'
        }
      },
      anvil: {
        src: ['src/anvil.ts'],
        dest: 'distr/',
        options: {
          basePath: 'src/',
          module: 'amd'
        }
      },
    },
    watch: {
      files: '**/*.ts',
      tasks: ['typescript:raven', 'typescript:anvil']
    },
  });

  grunt.registerTask('default', ['watch']);
  grunt.registerTask('raven', ['typescript:raven']);
  grunt.registerTask('anvil', ['typescript:anvil']);
 
}