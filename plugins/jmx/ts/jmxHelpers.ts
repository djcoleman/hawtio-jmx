/// <reference path="../../includes.ts"/>
/// <reference path="workspace.ts"/>
/**
 * @module Core
 */
module Core {
  // Add a few functions to the Core namespace
  /**
   * Returns the Folder object for the given domain name and type name or null if it can not be found
   * @method getMBeanTypeFolder
   * @for Core
   * @static
   * @param {Workspace} workspace
   * @param {String} domain
   * @param {String} typeName}
   * @return {Folder}
   */
  export function getMBeanTypeFolder(workspace:Workspace, domain: string, typeName: string):Folder {
    if (workspace) {
      var mbeanTypesToDomain = workspace.mbeanTypesToDomain || {};
      var types = mbeanTypesToDomain[typeName] || {};
      var answer = types[domain];
      if (angular.isArray(answer) && answer.length) {
        return answer[0];
      }
      return answer;
    }
    return null;
  }

  /**
   * Returns the JMX objectName for the given jmx domain and type name
   * @method getMBeanTypeObjectName
   * @for Core
   * @static
   * @param {Workspace} workspace
   * @param {String} domain
   * @param {String} typeName
   * @return {String}
   */
  export function getMBeanTypeObjectName(workspace:Workspace, domain: string, typeName: string):string {
    var folder = Core.getMBeanTypeFolder(workspace, domain, typeName);
    return Core.pathGet(folder, ["objectName"]);
  }

  /**
   * Creates a remote workspace given a remote jolokia for querying the JMX MBeans inside the jolokia
   * @param remoteJolokia
   * @param $location
   * @param localStorage
   * @return {Core.Workspace|Workspace}
   */
  export function createRemoteWorkspace(remoteJolokia, $location, localStorage, $rootScope = null, $compile = null, $templateCache = null, userDetails = null, HawtioNav = null) {
    // lets create a child workspace object for the remote container
    var jolokiaStatus = {
      xhr: null
    };
    // disable reload notifications
    var jmxTreeLazyLoadRegistry = Core.lazyLoaders;
    var profileWorkspace = new Workspace(remoteJolokia, jolokiaStatus, jmxTreeLazyLoadRegistry, $location, $compile, $templateCache, localStorage, $rootScope, userDetails, HawtioNav);

    log.info("Loading the profile using jolokia: " + remoteJolokia);
    profileWorkspace.loadTree();
    return profileWorkspace;
  }


}
/**
 * @module Jmx
 */
module Jmx {

  export var pluginName = 'hawtio-jmx';
  export var log:Logging.Logger = Logger.get(pluginName);
  export var currentProcessId = '';
  export var templatePath = 'plugins/jmx/html';

  export function getUrlForThing(jolokiaUrl, action, mbean, name) {
    var uri:any = new URI(jolokiaUrl);
    uri.segment(action)
      .segment(mbean)
      .segment(name);
    return uri.toString();
  }

  export function getNavItems(builder, workspace, $templateCache, prefix:string = 'jmx'):Array<HawtioMainNav.NavItem> {
    var attributes = builder.id(prefix + '-attributes')
                       .title( () => '<i class="fa fa-list"></i> Attributes' )
                       .tooltip( () => 'List the attributes on the MBean')
                       .href( () => '/jmx/attributes' + workspace.hash() )
                       .build();
    var operations = builder.id(prefix + '-operations')
                      .title( () => '<i class="fa fa-leaf"></i> Operations' )
                      .tooltip( () => 'List the operations on the MBean')
                      .href( () => '/jmx/operations' + workspace.hash() )
                      .build();
    var chart = builder.id(prefix + '-chart')
                      .title( () => '<i class="fa fa-bar-chart"></i> Charts' )
                      .tooltip( () => 'Real time chart of the attributes from the MBean')
                      .href( () => '/jmx/charts' + workspace.hash() )
                      .build();
    var editChart = builder.id(prefix + '-edit-chart')
                      .title( () => '<i class="fa fa-cog"></i> Edit Chart' )
                      .tooltip( () => 'Edit the chart to choose which attributes to show from the MBean')
                      .href( () => '/jmx/chartEdit' + workspace.hash() )
                      .build();

    var addToDashboard = builder.id(prefix + '-add-dashboard')
                      .title( () => '<i class="fa fa-share"></i>' )
                      .tooltip( () => 'Add current view to dashboard')
                      .attributes({
                        'class': 'pull-right'
                      })
                      .show( () => {
                        if (!HawtioCore.injector) {
                          return true;
                        }
                        var dash = HawtioCore.injector.get<any>('HawtioDashboard');
                        return dash && dash.hasDashboard;
                      })
                      .click( () => {
                        if (!HawtioCore.injector) {
                          return;
                        }
                        var dash = HawtioCore.injector.get<any>('HawtioDashboard');
                        if (dash) {
                          var width = 2;
                          var height = 2;
                          var title = workspace.getSelectedMBeanName();
                          var $location = workspace.$location;
                          if ($location.path().has('/jmx/charts')) {
                            width = 4;
                            height = 3;
                          }
                          var url = dash.getAddLink(title, width, height);
                          workspace.$location.url(url.toString());
                          Core.$apply(workspace.$rootScope);
                        }
                        return false;
                      })
                      .href( () => '' )
                      .build();

    editChart.show = () => workspace.isLinkActive('jmx/chart');
    return [attributes, operations, chart, editChart, addToDashboard];
  }

  var attributesToolBars = {};

  export function findLazyLoadingFunction(workspace, folder) {
    var factories = workspace.jmxTreeLazyLoadRegistry[folder.domain];
    var lazyFunction = null;
    if (factories && factories.length) {
      angular.forEach(factories, (customLoader) => {
        if (!lazyFunction) {
          lazyFunction = customLoader(folder);
        }
      });
    }
    return lazyFunction;
  }


  export function registerLazyLoadHandler(domain: string, lazyLoaderFactory: (folder: Core.Folder) => any) {
    if (!Core.lazyLoaders) {
      Core.lazyLoaders = {};
    }
    var array = Core.lazyLoaders[domain];
    if (!array) {
      array = [];
      Core.lazyLoaders[domain] = array;
    }
    array.push(lazyLoaderFactory);
  }

  export function unregisterLazyLoadHandler(domain: string, lazyLoaderFactory: (folder: Core.Folder) => any) {
    if (Core.lazyLoaders) {
      var array = Core.lazyLoaders[domain];
      if (array) {
        array.remove(lazyLoaderFactory);
      }
    }
  }

  /**
   * Registers a toolbar template for the given plugin name, jmxDomain.
   * @method addAttributeToolBar
   * @for Jmx
   * @param {String} pluginName used so that we can later on remove this function when the plugin is removed
   * @param {String} jmxDomain the JMX domain to avoid having to evaluate too many functions on each selection
   * @param {Function} fn the function used to decide which attributes tool bar should be used for the given select
   */
  export function addAttributeToolBar(pluginName: string, jmxDomain: string, fn: (NodeSelection) => string) {
    var array = attributesToolBars[jmxDomain];
    if (!array) {
      array = [];
      attributesToolBars[jmxDomain] = array;
    }
    array.push(fn);
  }

  /**
   * Try find a custom toolbar HTML template for the given selection or returns the default value
   * @method getAttributeToolbar
   * @for Jmx
   * @param {Core.NodeSelection} node
   * @param {String} defaultValue
   */
  export function getAttributeToolBar(node: NodeSelection, defaultValue?:string) {
    if (!defaultValue) {
      defaultValue = UrlHelpers.join(templatePath, 'attributeToolBar.html');
    }
    var answer = null;
    var jmxDomain = (node) ? node.domain : null;
    if (jmxDomain) {
      var array = attributesToolBars[jmxDomain];
      if (array) {
        for (var i = 0; i < array.length; i++) {
          var fn = array[i];
          if (fn) {
            answer = fn(node);
            if (answer) break;
          }
        }
      }
    }
    return (answer) ? answer : defaultValue;
  }


  export function updateTreeSelectionFromURL($location, treeElement, activateIfNoneSelected = false) {
    updateTreeSelectionFromURLAndAutoSelect($location, treeElement, null, activateIfNoneSelected);
  }

  export function updateTreeSelectionFromURLAndAutoSelect($location, treeElement, autoSelect, activateIfNoneSelected = false) {
    var dtree = <any>treeElement.dynatree("getTree");
    if (dtree) {
      var node = <any>null;
      var key = $location.search()['nid'];
      if (key) {
        try {
          node = <any>dtree.activateKey(key);
        } catch (e) {
          // tree not visible we suspect!
        }
      }
      if (node) {
        node.expand(true);
      } else {
        if (!treeElement.dynatree("getActiveNode")) {
          // lets expand the first node
          var root = treeElement.dynatree("getRoot");
          var children = root ? root.getChildren() : null;
          if (children && children.length) {
            var first = children[0];
            first.expand(true);
            // invoke any auto select function, and use its result as new first, if any returned
            if (autoSelect) {
              var result = autoSelect(first);
              if (result) {
                first = result;
              }
            }
            if (activateIfNoneSelected) {
              first.expand();
              first.activate();
            }
          } else {
/*
            causes NPE :)

            var first = children[0];
            first.expand(true);
            if (activateIfNoneSelected) {
              first.activate();
            }
*/
          }
        }
      }
    }
  }

  export function getUniqueTypeNames(children) {
    var typeNameMap = {};
    angular.forEach(children, (mbean) => {
      var typeName = mbean.typeName;
      if (typeName) {
        typeNameMap[typeName] = mbean;
      }
    });
    // only query if all the typenames are the same
    var typeNames = Object.keys(typeNameMap);
    return typeNames;
  }

  export function enableTree($scope, $location: ng.ILocationService, workspace: Core.Workspace, treeElement, children, redraw = false, onActivateFn = null) {
    //$scope.workspace = workspace;
    if (treeElement.length) {
      if (!onActivateFn) {
        onActivateFn = (node:DynaTreeNode) => {
          var data = node.data;
          //$scope.select(data);
          workspace.updateSelectionNode(data);
          Core.$apply($scope);
        };
      }
      workspace.treeElement = treeElement;
      treeElement.dynatree({
        /*
         * The event handler called when a different node in the tree is selected
         */
        onActivate: onActivateFn,
        onLazyRead: function(treeNode) {
          var folder = treeNode.data;
          var plugin = <(workspace:Core.Workspace, folder:Core.Folder, func:() => void) => void> null;
          if (folder) {
            plugin = Jmx.findLazyLoadingFunction(workspace, folder);
          }
          if (plugin) {
            console.log("Lazy loading folder " + folder.title);
            var oldChildren = folder.childen;
            plugin(workspace, folder, () => {
              treeNode.setLazyNodeStatus(DTNodeStatus_Ok);
              var newChildren = folder.children;
              if (newChildren !== oldChildren) {
                treeNode.removeChildren();
                angular.forEach(newChildren, newChild => {
                  treeNode.addChild(newChild);
                });
              }
            });
          } else {
            treeNode.setLazyNodeStatus(DTNodeStatus_Ok);
          }
        },
        onClick: function (node:DynaTreeNode, event:Event) {
          if (event["metaKey"]) {
            event.preventDefault();
            var url = $location.absUrl();
            if (node && node.data) {
              var key = node.data["key"];
              if (key) {
                var hash = $location.search();
                hash["nid"] = key;

                // TODO this could maybe be a generic helper function?
                // lets trim after the ?
                var idx = url.indexOf('?');
                if (idx <= 0) {
                  url += "?";
                } else {
                  url = url.substring(0, idx + 1);
                }
                url += $.param(hash);
              }
            }
            window.open(url, '_blank');
            window.focus();
            return false;
          }
          return true;
        },
        persist: false,
        debugLevel: 0,
        //children: $scope.workspace.tree.children
        children: children,
        imagePath: './'
      });

      if (redraw) {
        workspace.redrawTree();
      }
    }
  }
}
