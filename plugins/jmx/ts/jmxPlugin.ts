/// <reference path="../../jvm/ts/jvmHelpers.ts"/>
/// <reference path="jmxHelpers.ts"/>
/// <reference path="widgetRepository.ts"/>
/// <reference path="workspace.ts"/>
/// <reference path="common/common.module.ts"/>
/// <reference path="attributes/attributes.module.ts"/>
/// <reference path="operations/operations.module.ts"/>
/// <reference path="tree/tree.module.ts"/>

namespace Jmx {

  export var _module = angular.module(pluginName, [
    'angularResizable',
    commonModule,
    attributesModule,
    operationsModule,
    treeModule
  ]);

  _module.config(['HawtioNavBuilderProvider', "$routeProvider", (builder: HawtioMainNav.BuilderFactory, $routeProvider) => {

    $routeProvider
      .when('/jmx', { redirectTo: '/jmx/attributes' })
      .when('/jmx/attributes', {templateUrl: UrlHelpers.join(templatePath, 'attributes/attributes.html')})
      .when('/jmx/operations', {template: '<operations></operations>'})
      .when('/jmx/charts', {templateUrl: UrlHelpers.join(templatePath, 'charts.html')})
      .when('/jmx/chartEdit', {templateUrl: UrlHelpers.join(templatePath, 'chartEdit.html')})
      .when('/jmx/help/:tabName', {templateUrl: 'app/core/html/help.html'})
      .when('/jmx/widget/donut', {templateUrl: UrlHelpers.join(templatePath, 'donutChart.html')})
      .when('/jmx/widget/area', {templateUrl: UrlHelpers.join(templatePath, 'areaChart.html')});
  }]);

  _module.factory('jmxWidgetTypes', () => Jmx.jmxWidgetTypes);

  _module.factory('jmxWidgets', () => Jmx.jmxWidgets);

  // Create the workspace object used in all kinds of places
  _module.factory('workspace', ["$location", "jmxTreeLazyLoadRegistry", "$compile", "$templateCache", "localStorage", "jolokia", "jolokiaStatus", "$rootScope", "userDetails", "HawtioNav", (
    $location: ng.ILocationService,
    jmxTreeLazyLoadRegistry,
    $compile: ng.ICompileService,
    $templateCache: ng.ITemplateCacheService,
    localStorage: Storage,
    jolokia: Jolokia.IJolokia,
    jolokiaStatus: JVM.JolokiaStatus,
    $rootScope,
    userDetails,
    HawtioNav: HawtioMainNav.Registry) => {
    let workspace = new Workspace(jolokia, jolokiaStatus, jmxTreeLazyLoadRegistry, $location, $compile, $templateCache, localStorage, $rootScope, HawtioNav);
    workspace.loadTree();
    return workspace;
  }]);

  _module.constant('layoutTree', 'plugins/jmx/html/layoutTree.html');

  _module.factory('jmxTreeLazyLoadRegistry', () => Core.lazyLoaders);

  _module.run(["HawtioNav", "$location", "workspace", "viewRegistry", "layoutTree", "layoutFull", "jolokia", "helpRegistry", "pageTitle", "$templateCache", (
      nav: HawtioMainNav.Registry,
      $location: ng.ILocationService,
      workspace: Workspace,
      viewRegistry,
      layoutTree: string,
      layoutFull,
      jolokia: Jolokia.IJolokia,
      helpRegistry,
      pageTitle,
      $templateCache: ng.ITemplateCacheService) => {

    log.debug('JMX plugin loaded');

    viewRegistry['jmx'] = layoutTree;
    viewRegistry['{ "tab": "notree" }'] = layoutFull;
    helpRegistry.addUserDoc('jmx', 'plugins/jmx/doc/help.md');

    pageTitle.addTitleElement(() => {
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
