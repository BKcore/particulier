import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import babelConfig from './babel.config.js';

function glsl () {
  return {
    transform(code, id) {
      if(!/\.glsl$/.test(id)) return;

      var transformedCode = 'export default ' + JSON.stringify(
        code
          .replace(/[ \t]*\/\/.*\n/g, '')
          .replace(/[ \t]*\/\*[\s\S]*?\*\//g, '')
          .replace(/\n{2,}/g, '\n')
     ) + ';';
      return {
        code: transformedCode,
        map: { mappings: '' }
      }
    }
  };
}

let cache = {data: null};

export default {
  entry: 'src/index.js',
  format: 'cjs',
  cache: cache.data,
  plugins: [
    json(),
    glsl(),
    babel(babelConfig),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true,
      extensions: ['.js', '.jsx']
    }),
    commonjs({
      include: 'node_modules/**'
    })
  ],
  dest: 'build/bundle.js'
};
