var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var api = require('./api');

module.exports = function (mongoose) {
  var app = express();

  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', api(mongoose));

  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
      res.status(err.status || 500)
          .send({
            message: err.message,
            error: err
          });
    });
  }

  app.use(function (err, req, res, next) {
    res.status(err.status || 500)
        .send({
          message: err.message,
          error: {}
        });
  });

  return app;
};