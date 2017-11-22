/// <reference path="tree.component.ts"/>

namespace Jmx {

  export const treeModule = angular
    .module('hawtio-jmx-tree', [])
    .component('treeHeader', treeHeaderComponent)
    .component('tree', treeComponent)
    .name;

}