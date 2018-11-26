const path = require('path');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    port: 3000,
    compress: true,
    host: '0.0.0.0',
    contentBase: path.resolve(__dirname, 'dist'),
    open: true,
    stats: 'minimal',
    overlay: {
      warnings: true, // reports errors in browser window
      errors: true,
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve('src/examples/index.html'),
      inject: 'body',
    }),
  ],
});
