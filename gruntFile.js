module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        env: {
            dev: {
                NODE_ENV: 'dev'
            }
        },
        mochacli: {
            src: ['test/**/*.js'],
            options: {
                timeout: 3000,
                ignoreLeaks: false,
                ui: 'bdd',
                reporter: 'spec'
            }
        },
        eslint: {
            target: ['lib/**/*.js', 'index.js']
        }
    });

    grunt.registerTask('default', ['eslint', 'mochacli']);
};
