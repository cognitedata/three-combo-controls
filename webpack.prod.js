const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const nodeExternals = require('webpack-node-externals');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  // Do not bundle the node_modules folder into the bundle
  externals: [nodeExternals()],
});
