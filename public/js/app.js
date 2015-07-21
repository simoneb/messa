(function (angular, _) {

  angular.bootstrap().invoke(function ($http) {
    $http.get('config')
        .success(function (config) {
          angular.module('app.config', []).constant('CONFIG', config);
          angular.bootstrap(document, ['app']);
        });
  });

  angular
      .module('app', ['app.config', 'ngMaterial', 'ngMessages', 'ui.grid', 'ui.grid.selection', 'ui.grid.resizeColumns', 'ui.grid.autoResize'])
      .constant('_', _)
      .config(function ($mdThemingProvider) {
        $mdThemingProvider.theme('default')
            .primaryPalette('brown')
            .accentPalette('red');
      })
      .config(function ($httpProvider) {
        $httpProvider.interceptors.push('httpErrorInterceptor');
      })
      .run(function ($window, _) {
        function resize() {
          angular.element('#grid')
              .css('height', parseInt(angular.element('#content').css('height'), 10) - 100);
        }

        angular.element($window).on('load resize', _.debounce(resize, 100));
      })
      .directive('json', function () {
        return {
          restrict: 'A',
          require: 'ngModel',
          link: function (scope, elm, attrs, ctrl) {
            ctrl.$validators.json = function (modelValue, viewValue) {
              if (ctrl.$isEmpty(modelValue)) {
                // consider empty models to be valid
                return true;
              }

              try {
                angular.fromJson(viewValue);
                return true;
              } catch (err) {
                return false;
              }
            };
          }
        };
      })
      .directive('objectId', function () {
        return {
          restrict: 'A',
          require: 'ngModel',
          link: function (scope, elm, attrs, ctrl) {
            ctrl.$validators.objectId = function (modelValue, viewValue) {
              if (ctrl.$isEmpty(modelValue)) {
                // consider empty models to be valid
                return true;
              }

              return /^[a-fA-F0-9]{24}$/.test(viewValue);
            };
          }
        };
      })
      .directive('messModel', function () {
        return {
          require: ['^form', 'messModel'],
          restrict: 'E',
          scope: {
            model: '=',
            paths: '=',
            showHiddenFields: '='
          },
          link: function (scope, element, attrs, ctrls) {
            ctrls[1].form = ctrls[0];
          },
          templateUrl: 'templates/model.html',
          controller: 'ModelController',
          controllerAs: 'mc',
          bindToController: true
        }
      })
      .directive('messModelProxy', function ($compile) {
        return {
          restrict: 'E',
          scope: {
            model: '=',
            paths: '=',
            showHiddenFields: '='
          },
          template: '<div></div>',
          link: function (scope, element, attrs) {
            element.append("<mess-model model='model' paths='paths' show-hidden-fields='showHiddenFields'></mess-model>");
            $compile(element.contents())(scope);
          }
        }
      })
      .filter('showHiddenModelFields', function () {
        return function (paths, show) {
          if (show) return paths;

          return _.pick(paths, function (value, key) {
            return !/^_/.test(key);
          });
        }
      })
      .factory('api', api)
      .factory('httpErrorInterceptor', httpErrorInterceptor)
      .controller('EditController', EditController)
      .controller('MainController', MainController)
      .controller('ModelController', ModelController);

  function api($http, _) {
    return {
      getSchemas: getSchemas,
      getModelData: getModelData,
      createModel: createModel,
      updateModel: updateModel,
      deleteModel: deleteModel
    };

    function getSchemas() {
      return $http.get('api/schemas').then(function (res) {
        return res.data;
      });
    }

    function getModelData(modelName) {
      return $http.get('api/' + modelName).then(function (res) {
        return res.data;
      });
    }

    function createModel(modelName, model) {
      return $http.post('api/' + modelName, model).then(function (res) {
        return res.data;
      });
    }

    function updateModel(modelName, id, model) {
      return $http.put('api/' + modelName + '/' + id, model).then(function (res) {
        return res.data;
      });
    }

    function deleteModel(modelName, id) {
      return $http.delete('api/' + modelName + '/' + id).then(function (res) {
        return res.data;
      });
    }
  }

  function MainController(CONFIG, api, $mdSidenav, $mdDialog, $log, _) {
    var mc = this;

    mc.title = CONFIG.title || 'MESS - mongoose express scaffold';
    mc.selectedModelName = null;
    mc.schemas = null;
    mc.gridOptions = {
      // selection
      multiselect: false,
      enableRowHeaderSelection: false,
      enableFullRowSelection: true,

      columnDefs: [],
      onRegisterApi: function (gridApi) {
        mc.gridApi = gridApi;
        handleGridApiRegistration();
      }
    };

    mc.selectModel = selectModel;
    mc.createModel = createModel;
    mc.toggleList = toggleList;

    activate();

    function activate() {
      getSchemas().then(function (schemas) {
        mc.modelNames = _.keys(schemas);

        if (mc.modelNames.length) {
          selectModel(mc.modelNames[0]);
        }
      });
    }

    function handleGridApiRegistration() {
      mc.gridApi.selection.on.rowSelectionChanged(null, function (row) {
        if (row.isSelected) {
          editModel(row);
        }
      });
    }

    function createModel() {
      showEditDialog({}, angular.noop);
    }

    function editModel(row) {
      showEditDialog(row.entity, editModel.bind(null, row))
          .finally(function () {
            row.setSelected(false);
          });
    }

    function showEditDialog(model, editModel) {
      return $mdDialog.show({
        templateUrl: 'templates/edit.html',
        controller: 'EditController',
        controllerAs: 'ec',
        bindToController: true,
        locals: {
          modelName: mc.selectedModelName,
          model: angular.copy(model),
          schema: mc.selectedSchema,
          editModel: editModel,
          reloadModels: getModelData.bind(null, mc.selectedModelName, mc.selectedSchema)
        }
      }).then(function () {
        getModelData(mc.selectedModelName, mc.selectedSchema);
      })
    }

    function getSchemas() {
      return api.getSchemas()
          .then(function (schemas) {
            return mc.schemas = schemas;
          });
    }

    function toggleList() {
      $mdSidenav('left').toggle();
    }

    function selectModel(modelName) {
      mc.selectedModelName = modelName;
      mc.selectedSchema = mc.schemas[mc.selectedModelName];

      mc.gridOptions.columnDefs = createGridColumns(mc.selectedSchema);

      getModelData(mc.selectedModelName, mc.selectedSchema);

      mc.toggleList();
    }

    function createGridColumns(schema) {
      return _(schema.paths)
          .map(function (path, pathName) {
            return {
              name: pathName,
              field: pathName,
              type: getColumnType(path),
              visible: pathName !== schema.options.versionKey
            };
          }).value();
    }

    function getColumnType(path) {
      switch (path.instance) {
        case 'String':
        case 'Boolean':
        case 'Number':
        case 'Date':
          return path.instance.toLowerCase();
        default:
          return 'object'
      }
    }

    function getModelData(modelName, schema) {
      var datePaths = _.filter(schema.paths, { instance: 'Date' });

      return api.getModelData(modelName).then(function (data) {
        mc.gridOptions.data = [].concat(data.map(function (item) {
          datePaths.forEach(function (datePath) {
            item[datePath.path] = new Date(item[datePath.path]);
          });
          return item;
        }));
      });
    }
  }

  function EditController($mdDialog, _, api) {
    var ec = this;

    ec.isNew = !ec.model._id;
    ec.showHiddenFields = false;

    ec.save = save;
    ec.cancel = cancel;
    ec.delete = _delete;
    ec.toggleShowHiddenFields = toggleShowHiddenFields;

    function save() {
      createOrUpdate().then(function () {
        $mdDialog.hide();
      });
    }

    function cancel() {
      $mdDialog.cancel();
    }

    function _delete() {
      $mdDialog.show($mdDialog.confirm()
          .title('Confirm removal')
          .content('Are you sure you want to remove this model?')
          .ok('Yes')
          .cancel('No'))
          .then(function () {
            api.deleteModel(ec.modelName, ec.model._id)
                .then(ec.reloadModels);
          }, function () {
            ec.editModel();
          });
    }

    function createOrUpdate() {
      if (ec.isNew) {
        return api.createModel(ec.modelName, ec.model);
      } else {
        return api.updateModel(ec.modelName, ec.model._id, ec.model);
      }
    }

    function toggleShowHiddenFields() {
      ec.showHiddenFields = !ec.showHiddenFields;
    }
  }

  function ModelController(api) {
    var mc = this;

    mc.refs = {};

    mc.loadRef = loadRef;

    mc.rootPaths = _.omit(mc.paths, function (value, key) {
      return /\./.test(key);
    });

    mc.nestedPaths = _(mc.paths)
        .pick(function (value, key) {
          return /\./.test(key);
        })
        .groupBy(function (value, key) {
          return key.split('.')[0];
        })
        .mapValues(function (paths, parentKey) {
          return _.reduce(paths.map(function (path) {
            var res = {};
            res[path.path.replace(parentKey + '.', '')] = path;
            return res;
          }), _.merge, {});
        })
        .value();

    function loadRef(modelName) {
      api.getModelData(modelName).then(function (data) {
        mc.refs[modelName] = data;
      });
    }
  }

  function httpErrorInterceptor($injector, $q) {
    return {
      responseError: function (res) {
        var $mdToast = $injector.get('$mdToast');

        $mdToast.show($mdToast.simple().content(res.data.message));

        return $q.reject(res);
      }
    }
  }

})(angular, _);