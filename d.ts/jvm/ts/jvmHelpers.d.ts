/// <reference path="../../includes.d.ts" />
/// <reference path="jvmGlobals.d.ts" />
/**
 * @module JVM
 */
declare module JVM {
    /**
     * Adds common properties and functions to the scope
     * @method configureScope
     * @for Jvm
     * @param {*} $scope
     * @param {ng.ILocationService} $location
     * @param {Core.Workspace} workspace
     */
    function configureScope($scope: any, $location: any, workspace: any): void;
    function hasLocalMBean(workspace: any): any;
    function hasDiscoveryMBean(workspace: any): any;
}
declare module Core {
    /**
     * Creates a jolokia object for connecting to the container with the given remote jolokia URL,
     * username and password
     * @method createJolokia
     * @for Core
     * @static
     * @param {String} url
     * @param {String} username
     * @param {String} password
     * @return {Object}
     */
    function createJolokia(url: string, username: string, password: string): any;
    function getRecentConnections(localStorage: any): any;
    function addRecentConnection(localStorage: any, name: any): void;
    function removeRecentConnection(localStorage: any, name: any): void;
    function clearConnections(): void;
    function isRemoteConnection(): boolean;
    function saveConnection(options: Core.ConnectOptions): void;
    function connectToServer(localStorage: any, options: Core.ConnectToServerOptions): void;
    /**
     * Loads all of the available connections from local storage
     * @returns {Core.ConnectionMap}
     */
    function loadConnectionMap(): Core.ConnectionMap;
    /**
     * Saves the connection map to local storage
     * @param map
     */
    function saveConnectionMap(map: Core.ConnectionMap): void;
    function getConnectionNameParameter(): any;
    /**
     * Returns the connection options for the given connection name from localStorage
     */
    function getConnectOptions(name: string, localStorage?: WindowLocalStorage): ConnectOptions;
    /**
     * Creates the Jolokia URL string for the given connection options
     */
    function createServerConnectionUrl(options: Core.ConnectOptions): string;
}
