/**
 * @module Core
 */
/// <reference path="jmxPlugin.ts"/>
module Jmx {

  // NOTE - $route is brought in here to ensure the factory for that service
  // has been called, otherwise the ng-include directive doesn't show the partial
  // after a refresh until you click a top-level link.
  export var ViewController = _module.controller("Jmx.ViewController", ["$scope", "$route", "$location", "layoutTree", "layoutFull", "viewRegistry", ($scope, $route, $location:ng.ILocationService, layoutTree, layoutFull, viewRegistry) => {

    findViewPartial();

    $scope.$on("$routeChangeSuccess", function (event, current, previous) {
      findViewPartial();
    });

    function searchRegistry(path) {
      var answer = undefined;
      _.forIn(viewRegistry, function (value, key) {
        if (!answer) {
          if (_.startsWith(key, "/") && _.endsWith(key, "/")) {
            // assume its a regex
            var text = key.substring(1, key.length - 1);
            try {
              var reg = new RegExp(text, "");
              if (reg.exec(path)) {
                answer = value;
              }
            } catch (e) {
              log.debug("Invalid RegExp " + text + " for viewRegistry value: " + value);
            }
          } else {
            if (_.startsWith(path, key)) {
              answer = value;
            }
          }
        }
      });
      //log.debug("Searching for: " + path + " returning: ", answer);
      return answer;
    }

    function findViewPartial() {

      var answer = null;
      var hash = $location.search();
      var tab = hash['tab'];
      if (angular.isString(tab)) {
        answer = searchRegistry(tab);
      }
      if (!answer) {
        var path = $location.path();
        if (path) {
          if (_.startsWith(path, "/")) {
            path = path.substring(1);
          }
          answer = searchRegistry(path);
        }
      }
      if (!answer) {
        answer = layoutTree;
      }
      $scope.viewPartial = answer;

      log.debug("Using view partial: " + answer);
      return answer;
    }
  }]);
}
