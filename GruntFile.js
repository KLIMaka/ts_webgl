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
      build: {
        src: ['src/build.ts'],
        dest: 'distr/',
        options: {
          basePath: 'src/',
          module: 'amd'
        }
      },
    },
    watch: {
      all: {
        files: '**/*.ts',
        tasks: ['typescript:raven', 'typescript:anvil']
      },
      raven: {
        files: '**/*.ts',
        tasks: ['typescript:raven']
      },
      anvil: {
        files: '**/*.ts',
        tasks: ['typescript:anvil']
      }
    },
  });

  grunt.registerTask('default', ['watch']);
  grunt.registerTask('raven', ['typescript:raven']);
  grunt.registerTask('anvil', ['typescript:anvil']);
  grunt.registerTask('build', ['typescript:build']);
 
}