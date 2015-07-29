var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var api = require('./api');

module.exports = function (mongoose, options) {
  var app = express();

  options = options || {};

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/config', function (req, res) {
    res.send(options);
  });

  app.use('/api', api(mongoose));

  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  app.use(function (err, req, res, next) {
    res.status(err.status || 500)
        .send({
          message: err.message,
          error: {}
        });
  });

  return app;
};