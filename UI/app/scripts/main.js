﻿var app = angular.module('app', ['bootstrap.fileField', 'ngStorage', 'ngTable', 'services', 'directives', 'ngRoute', 'ngAnimate', 'ngMessages', 'ngSanitize', 'ui.bootstrap', 'loadingStatus']);

app.config(['$routeProvider', function ($routeProvider) {
    $routeProvider.
    when('/ejercicios', {
        controller: 'ejerciciosController',
        templateUrl:  'ejercicios.html'
    }).
    when('/musicas/', {
        controller: 'musicasController',
        templateUrl: 'musicas.html'
    }).
    when('/cargarMusica/', {
        controller: 'cargarMusicaController',
        templateUrl: 'cargarMusica.html'
    }).
    when('/cargarEjercicios/', {
        controller: 'cargarEjerciciosController',
        templateUrl: 'cargarEjercicios.html'
    }).
    when('/clases/', {
        controller: 'clasesController',
        templateUrl: 'clases.html'
    }).
    when('/acercade/', {
        controller: 'aboutController',
        templateUrl: 'about.html'
    }).
    when('/importarMusica/', {
        controller: 'importMusicaController',
        templateUrl: 'importMusica.html'
    }).
    when('/agregarMusicaManual/', {
        controller: 'agregarMusicaManualController',
        templateUrl: 'agregarMusicaManual.html'
    }).
    when('/clase/:id', {
        controller: 'claseController',
        templateUrl: 'clase.html'
        ,resolve: {
                id: [
                    '$route', function($route) {
                        return $route.current.params.id;
                    }
                ]
            }
        }).
    when('/', {
        redirectTo: '/clases'
    }).
    otherwise({
        redirectTo: '/'
    });
}]
);

var ddlSiNoOptions = [{ text: 'Si', value: 'Si' }, { text: 'No', value: 'No' }];
var ddlDias = [{ text: 'Lunes', value: 1 }, { text: 'Martes', value: 2 }, { text: "Miercoles", value: 3 }, { text: "Jueves", value: 4 }, { text: "Viernes", value: 5 }, { text: "Sabado", value: 6 }, { text: "Domingo", value: 7 }];



function cloneObj(obj)
{
    return JSON.parse(JSON.stringify(obj));
}
var regexIso8601 = /^(\d{4}|\+\d{6})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})\.(\d{1,})(Z|([\-+])(\d{2}):(\d{2}))?)?)?)?$/;
var reMsAjax = /^\/Date\((d|-|.*)\)[\/|\\]$/;

function convertDateStringsToDates(input) {
    // Ignore things that aren't objects.
    if (typeof input !== "object") return input;

    for (var key in input) {
        if (!input.hasOwnProperty(key)) continue;

        var value = input[key];
        var match;
        // Check for string properties which look like dates.
        if (typeof value === "string" && (match = value.match(regexIso8601))) {
            var milliseconds = Date.parse(match[0]);
            if (!isNaN(milliseconds)) {
                input[key] = new Date(milliseconds);
            }
        } else if (typeof value === "string" ) {
            var a = reMsAjax.exec(value);
            if (a) {
                var b = a[1].split(/[-+,.]/);
                input[key] = new Date(b[0] ? +b[0] : 0 - +b[1]);
            }
        } else if (typeof value === "object") {
            // Recurse into object
            convertDateStringsToDates(value);
        }
    }
}

app.config(["$httpProvider", function ($httpProvider) {
    $httpProvider.defaults.transformResponse.push(function (responseData) {
        convertDateStringsToDates(responseData);
        return responseData;
    });
}]);


app.service('httpWrapper', ['$http', '$location', 'contextService', function ($http, $location, contextService) {
    var httpWrapper = {};

    httpWrapper.get = function (url, a) {
        if (!contextService.usuario && $location.path() !== "/acceso") $location.path("/acceso");
        return $http.get(url, a);
    }

    httpWrapper.post = function (url, a, b) {
        if (!contextService.usuario && $location.path() !== "/acceso") $location.path("/acceso");
        return $http.post(url, a, b);
    }

    return httpWrapper;
}]);

function toValidJsVariableName(nombre) {
    //if (typeof nombre === "undefined") debugger;
    return nombre.toLowerCase().replace(/ | /g, "_").replace(/\"|\'|,|\(|\)|“|”|-|:|\?|\/|~|\./g, "").normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
}

function clearStorage() {
    window.localStorage.removeItem("ngStorage-biosoft_colecciones");
    window.localStorage.removeItem("ngStorage-biosoft_ejercicios");
    var items = window.localStorage;
    var count = items.length -1;
    for (var i = 0; i < count; i++) {
        if (items.key(count - i).substring(0, 25) === "ngStorage-biosoft_musica_") window.localStorage.removeItem(items.key(i));
    }
}

//clearStorage();

function getCurrentPath() {
    if (window.location.href.substring(0, 4) !== "file") return;
    var path = window.location.href.substring(8);
    path = path.substring(0, path.lastIndexOf("#"));
    path = path.substring(0, path.lastIndexOf("/") +1);
    return path;
}
