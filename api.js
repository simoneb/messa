var router = require('express').Router();
var _ = require('lodash');

module.exports = function(mongoose) {
  router.get('/schemas', function (req, res, next) {
    res.status(200).send(mongoose.modelSchemas);
  });

  router.route('/:modelName')
      .get(findModels)
      .post(createModel);

  router.route('/:modelName/:id')
      .get(getModelById)
      .put(updateModel)
      .delete(deleteModel);

  function findModels(req, res, next) {
    mongoose.model(req.params.modelName).find(function (err, models) {
      if (err) return next(err);
      res.status(200).send(models);
    });
  }

  function createModel(req, res, next) {
    mongoose.model(req.params.modelName)
        .create(req.body, function (err, model) {
          if (err) return next(err);
          res.status(201).send(model);
        });
  }

  function getModelById(req, res, next) {
    mongoose.model(req.params.modelName)
        .findById(req.params.id, function (err, model) {
          if (err) return next(err);
          res.status(200).send(model);
        });
  }

  function updateModel(req, res, next) {
    mongoose.model(req.params.modelName)
        .findById(req.params.id, function (err, model) {
          if (err) return next(err);
          if (!model) return next(new Error('model not found'));

          _.assign(model, req.body).save(function (err, model) {
            if (err) return next(err);
            res.status(200).send(model);
          });
        });
  }

  function deleteModel(req, res, next) {
    mongoose.model(req.params.modelName)
        .findById(req.params.id, function (err, model) {
          if (err) return next(err);
          if (!model) return next(new Error('model not found'));

          model.remove(function (err) {
            if (err) return next(err);
            res.status(204).send();
          });
        });
  }

  return router;
};
