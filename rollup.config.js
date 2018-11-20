import typescript from 'rollup-plugin-typescript2';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import pkg from './package.json';

const serveOptions = {
  open: true,
  contentBase: ['dist', 'examples'],
  port: 3001,
};

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'umd',
      name: 'ComboControls',
      globals: {
        three: 'THREE',
      },
    },
    {
      file: pkg.module,
      format: 'es',
    },
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  plugins: [
    typescript({
      typescript: require('typescript'),
    }),
    serve(serveOptions),
    livereload(),
  ],
};
