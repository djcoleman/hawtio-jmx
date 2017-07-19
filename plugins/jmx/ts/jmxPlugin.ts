/// <reference path="../../jvm/ts/jvmHelpers.ts"/>
/// <reference path="jmxHelpers.ts"/>
/// <reference path="widgetRepository.ts"/>
/// <reference path="workspace.ts"/>
/// <reference path="common/common.module.ts"/>
/// <reference path="dashboard/dashboard.module.ts"/>
/// <reference path="operations/operations.module.ts"/>

namespace Jmx {

  export var _module = angular.module(pluginName, [
    CommonModule,
    DashboardModule,
    OperationsModule,
    'angularResizable'
  ]);

  _module.config(['HawtioNavBuilderProvider', "$routeProvider", (builder:HawtioMainNav.BuilderFactory, $routeProvider) => {

    $routeProvider
      .when('/jmx', { redirectTo: '/jmx/attributes' })
      .when('/jmx/attributes', {templateUrl: UrlHelpers.join(templatePath, 'attributes.html')})
      .when('/jmx/operations', {template: '<operations></operations>'})
      .when('/jmx/charts', {templateUrl: UrlHelpers.join(templatePath, 'charts.html')})
      .when('/jmx/chartEdit', {templateUrl: UrlHelpers.join(templatePath, 'chartEdit.html')})
      .when('/jmx/help/:tabName', {templateUrl: 'app/core/html/help.html'})
      .when('/jmx/widget/donut', {templateUrl: UrlHelpers.join(templatePath, 'donutChart.html')})
      .when('/jmx/widget/area', {templateUrl: UrlHelpers.join(templatePath, 'areaChart.html')})
      .when('/jmx/dashboard', {template: '<dashboard></dashboard>'})
  }]);

  _module.factory('jmxWidgetTypes', () => Jmx.jmxWidgetTypes);

  _module.factory('jmxWidgets', () => Jmx.jmxWidgets);

  // Create the workspace object used in all kinds of places
  _module.factory('workspace', ["$location", "jmxTreeLazyLoadRegistry", "$compile", "$templateCache", "localStorage", "jolokia", "jolokiaStatus", "$rootScope", "userDetails", "HawtioNav", ($location: ng.ILocationService, jmxTreeLazyLoadRegistry, $compile: ng.ICompileService, $templateCache: ng.ITemplateCacheService, localStorage: WindowLocalStorage, jolokia, jolokiaStatus, $rootScope, userDetails, HawtioNav) => {
    const workspace = new Workspace(jolokia, jolokiaStatus, jmxTreeLazyLoadRegistry, $location, $compile, $templateCache, localStorage, $rootScope, HawtioNav);
    workspace.loadTree();
    return workspace;
  }]);

  _module.controller("Jmx.TabController", ["$scope", "$route", "$location", "layoutTree", "layoutFull", "viewRegistry", "workspace", ($scope, $route, $location: ng.ILocationService, layoutTree, layoutFull, viewRegistry, workspace: Workspace) => {

    $scope.isTabActive = path => _.startsWith($location.path(), path);

    $scope.goto = (path: string) => $location.path(path);

    $scope.editChart = () => ($scope.isTabActive('jmx-chart') || $scope.isTabActive('jmx-edit-chart'))
      ? $scope.goto('/jmx/chartEdit', 'jmx-edit-chart') : false;

  }]);

  _module.factory('rbacACLMBean', function() {
    return {
      then: function() {}
    }
  });

  _module.constant('layoutTree', 'plugins/jmx/html/layoutTree.html');

  // holds the status returned from the last jolokia call (?)
  _module.factory('jolokiaStatus', () => {
    return {
      xhr: null
    };
  });

  export var DEFAULT_MAX_DEPTH = 7;
  export var DEFAULT_MAX_COLLECTION_SIZE = 500;

  _module.factory('jolokiaParams', ["jolokiaUrl", "localStorage", (jolokiaUrl, localStorage) => {
    var answer = {
      canonicalNaming: false,
      ignoreErrors: true,
      mimeType: 'application/json',
      maxDepth: DEFAULT_MAX_DEPTH,
      maxCollectionSize: DEFAULT_MAX_COLLECTION_SIZE
    };
    if ('jolokiaParams' in localStorage) {
      answer = angular.fromJson(localStorage['jolokiaParams']);
    } else {
      localStorage['jolokiaParams'] = angular.toJson(answer);
    }
    answer['url'] = jolokiaUrl;
    return answer;
  }]);

  _module.factory('jmxTreeLazyLoadRegistry', () => Core.lazyLoaders);

  _module.run(["HawtioNav", "$location", "workspace", "viewRegistry", "layoutTree", "layoutFull", "jolokia", "helpRegistry", "pageTitle", "$templateCache", (nav: HawtioMainNav.Registry, $location: ng.ILocationService, workspace: Workspace, viewRegistry, layoutTree, layoutFull, jolokia, helpRegistry, pageTitle, $templateCache) => {
    log.debug('loaded');

    viewRegistry['jmx'] = layoutTree;
    viewRegistry['{ "tab": "notree" }'] = layoutFull;
    helpRegistry.addUserDoc('jmx', 'plugins/jmx/doc/help.md');

    pageTitle.addTitleElement(():string => {
      if (Jmx.currentProcessId === '') {
        try {
          Jmx.currentProcessId = jolokia.getAttribute('java.lang:type=Runtime', 'Name');
        } catch (e) {
          // ignore
        }
        if (Jmx.currentProcessId && Jmx.currentProcessId.indexOf("@") !== -1) {
          Jmx.currentProcessId = "pid:" +  Jmx.currentProcessId.split("@")[0];
        }
      }
      return Jmx.currentProcessId;
    });

    const tab = nav.builder().id('jmx')
      .title(() => 'JMX')
      .defaultPage({
        rank: 10,
        isValid: (yes, no) => workspace.hasMBeans() ? yes() : no()
      })
      .isValid(() => workspace.hasMBeans())
      .href(() => '/jmx')
      .build();
    nav.add(tab);

  }]);

  hawtioPluginLoader.addModule(pluginName);
  hawtioPluginLoader.addModule('dangle');
}
