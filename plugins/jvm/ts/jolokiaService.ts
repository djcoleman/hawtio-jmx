/// <reference path="../../includes.ts"/>
/// <reference path="jvmPlugin.ts"/>

/**
 * @module JVM
 */
module JVM {

  var urlCandidates = ['/hawtio/jolokia', '/jolokia', 'jolokia'];
  var discoveredUrl = null;

  hawtioPluginLoader.registerPreBootstrapTask((next) => {
    var uri = new URI();
    var query = uri.query(true);
    log.debug("query: ", query);

    var jolokiaUrl = query['jolokiaUrl'];
    if (jolokiaUrl) {
      delete query['sub-tab'];
      delete query['main-tab'];
      jolokiaUrl = jolokiaUrl.unescapeURL();
      var jolokiaURI = new URI(jolokiaUrl);
      var name = query['title'] || 'Unknown Connection';
      var token = query['token'] || Core.trimLeading(uri.hash(), '#');
      var options = Core.createConnectOptions({
        name: name,
        scheme: jolokiaURI.protocol(),
        host: jolokiaURI.hostname(),
        port: Core.parseIntValue(jolokiaURI.port()),
        path: Core.trimLeading(jolokiaURI.pathname(), '/'),
        useProxy: false
      });
      if (!Core.isBlank(token)) {
        options['token'] = token;
      }
      _.merge(options, jolokiaURI.query(true));
      _.assign(options, query);
      log.debug("options: ", options);
      var connectionMap = Core.loadConnectionMap();
      connectionMap[name] = options;
      Core.saveConnectionMap(connectionMap);
      uri.hash("").query({
        con: name
      });
      window.location.replace(uri.toString());
    }

    var connectionName = query['con'];
    if (connectionName) {
      log.debug("Not discovering jolokia");
      // a connection name is set, no need to discover a jolokia instance
      next();
      return;
    }
    function maybeCheckNext(candidates) {
      if (candidates.length === 0) {
        next();
      } else {
        checkNext(candidates.pop());
      }
    }
    function checkNext(url) {
      log.debug("trying URL: ", url);
      $.ajax(url).always((data, statusText, jqXHR) => {
        if (jqXHR.status === 200) {
          try {
            var resp = angular.fromJson(data);
            //log.debug("Got response: ", resp);
            if ('value' in resp && 'agent' in resp.value) {
              discoveredUrl = url;
              log.debug("Found jolokia agent at: ", url, " version: ", resp.value.agent);
              next();
            } else {
              maybeCheckNext(urlCandidates);
            }
          } catch (e) {
            maybeCheckNext(urlCandidates);
          }
        } else if (jqXHR.status === 401 || jqXHR.status === 403) {
          // I guess this could be it...
          discoveredUrl = url;
          log.debug("Using URL: ", url, " assuming it could be an agent but got return code: ", jqXHR.status);
          next();
        } else {
          maybeCheckNext(urlCandidates);
        }
      });
    }
    checkNext(urlCandidates.pop());
  });

  export interface DummyJolokia extends Jolokia.IJolokia {
    isDummy: boolean;
    running:boolean;
  }

  _module.service('ConnectionName', ['$location', ($location:ng.ILocationService) => {
    var answer:string = null;
    return (reset = false):string => {
      if (!Core.isBlank(answer) && !reset) {
        return answer;
      } 
      answer = '';
      var search = $location.search();
      if ('con' in window) {
        answer = <string> window['con'];
        log.debug("Using connection name from window: ", answer);
      } else if ('con' in search) {
        answer = search['con'];
        log.debug("Using connection name from URL: ", answer);
      } else {
        log.debug("No connection name found, using direct connection to JVM");
      }
      return answer;
    }
  }]);

  _module.service('ConnectOptions', ['ConnectionName', (ConnectionName):any => {
    var name = ConnectionName();
    if (Core.isBlank(name)) {
      // this will fail any if (ConnectOptions) check
      return false;
    }
    var answer = Core.getConnectOptions(name);
    // search for passed credentials when connecting to remote server
    try {
      if (window.opener && "passUserDetails" in window.opener) {
        answer.userName = window.opener["passUserDetails"].username;
        answer.password = window.opener["passUserDetails"].password;
      }
    } catch (securityException) {
      // ignore
    }
    return answer;
  }]);

  // the jolokia URL we're connected to
  _module.factory('jolokiaUrl', ['ConnectOptions', 'documentBase', (ConnectOptions, documentBase) => {
    var answer = undefined;
    if (!ConnectOptions || !ConnectOptions.name) {
      log.debug("Using discovered URL");
      answer = discoveredUrl;
    } else {
      answer = Core.createServerConnectionUrl(ConnectOptions);
      log.debug("Using configured URL");
    }
    if (!answer) {
      // this will force a dummy jolokia instance
      return false;
    }
    // build full URL
    var windowURI = new URI();
    var jolokiaURI = undefined;
    if (_.startsWith(answer, '/')) {
      jolokiaURI = new URI(answer);
    } else {
      jolokiaURI = new URI(UrlHelpers.join(documentBase, answer));
    }
    if (!jolokiaURI.protocol()) {
      jolokiaURI.protocol(windowURI.protocol());
    }
    if (!jolokiaURI.hostname()) {
      jolokiaURI.host(windowURI.hostname());
    }
    if (!jolokiaURI.port()) {
      jolokiaURI.port(windowURI.port());
    }
    answer = jolokiaURI.toString();
    log.debug("Complete jolokia URL: ", answer);
    return answer;
  }]);

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

  _module.factory('jolokia',["$location", "localStorage", "jolokiaStatus", "$rootScope", "userDetails", "jolokiaParams", "jolokiaUrl", "ConnectOptions", "HawtioDashboard", ($location:ng.ILocationService, localStorage, jolokiaStatus, $rootScope, userDetails:Core.UserDetails, jolokiaParams, jolokiaUrl, connectionOptions, dash):Jolokia.IJolokia => {

    if (dash.inDashboard && windowJolokia) {
      return windowJolokia;
    }

    if (jolokiaUrl) {
      // pass basic auth credentials down to jolokia if set
      var username:String = null;
      var password:String = null;

      if (connectionOptions.userName && connectionOptions.password) {
        username = connectionOptions.userName;
        password = connectionOptions.password;
      } else if (angular.isDefined(userDetails) &&
          angular.isDefined(userDetails.username) &&
          angular.isDefined(userDetails.password)) {
        username = userDetails.username;
        password = userDetails.password;
      } else {
        // lets see if they are passed in via request parameter...
        var search = $location.search();
        username = search["_user"];
        password = search["_pwd"];
        if (angular.isArray(username)) username = username[0];
        if (angular.isArray(password)) password = password[0];
      }

      if (username && password && !connectionOptions.token) {
        userDetails.username = username;
        userDetails.password = password;
        log.debug("Setting authorization header to username/password");
        $.ajaxSetup({
          beforeSend: (xhr) => {
            xhr.setRequestHeader('Authorization', Core.getBasicAuthHeader(<string>username, <string>password));
          }
        });
      } else if (connectionOptions.token) {
        log.debug("Setting authorization header to token");
        $.ajaxSetup({
          beforeSend: (xhr) => {
            xhr.setRequestHeader('Authorization', 'Bearer ' + connectionOptions.token);
          }
        });
      } else {
        log.debug("Not setting any authorization header");
      }
      jolokiaParams['ajaxError'] = (xhr, textStatus, error) => {
        if (xhr.status === 401 || xhr.status === 403) {
          userDetails.username = null;
          userDetails.password = null;
          delete userDetails.loginDetails;
          delete window.opener["passUserDetails"];
        } else {
          jolokiaStatus.xhr = xhr;
          if (!xhr.responseText && error) {
            xhr.responseText = error.stack;
          }
        }
        Core.$apply($rootScope);
      };

      var jolokia = new Jolokia(jolokiaParams);
      jolokia.stop();

      // TODO this should really go away, need to track down any remaining spots where this is used
      //localStorage['url'] = jolokiaUrl;

      if ('updateRate' in localStorage) {
        if (localStorage['updateRate'] > 0) {
          jolokia.start(localStorage['updateRate']);
        }
      }
      windowJolokia = jolokia;
      return jolokia;
    } else {
      var answer = <DummyJolokia> {
        isDummy: true,
        running: false,
        request: (req:any, opts?:Jolokia.IParams) => null,
        register: (req:any, opts?:Jolokia.IParams) => <number>null,
        list: (path, opts?) => null,
        search: (mBeanPatter, opts?) => null,
        getAttribute: (mbean, attribute, path?, opts?) => null,
        setAttribute: (mbean, attribute, value, path?, opts?) => {},
        version: (opts?) => <Jolokia.IVersion>null,
        execute: (mbean, operation, ...args) => null,
        start: (period) => {
          answer.running = true;
        },
        stop: () => {
          answer.running = false;
        },
        isRunning: () => answer.running,
        jobs: () => []

      };
      windowJolokia = answer;
      // empty jolokia that returns nothing
      return answer;          
    }
  }]);

}
