var app = angular.module('app', ['bootstrap.fileField','ngStorage','ngTable','ui.grid', 'ui.grid.selection', 'ui.grid.edit', 'ui.grid.rowEdit', 'ui.grid.cellNav', 'ui.grid.resizeColumns', 'ui.grid.autoResize', 'services', 'directives', 'ngRoute', 'ngAnimate', 'ngMessages', 'ngSanitize', 'ui.bootstrap', 'toaster', 'loadingStatus', 'ui.select']);
var viewBase = 'file:///app/views/';

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
    when('/config/', {
        controller: 'configController',
        templateUrl: 'config.html'
    }).
    when('/', {
        redirectTo: '/ejercicios'
    }).
    otherwise({
        redirectTo: '/'
    });
}]
);
app.config(['$provide', function ($provide) {
    $provide.decorator('GridOptions', ['$delegate', 'i18nService', function ($delegate, i18nService) {
        var gridOptions;
        gridOptions = angular.copy($delegate);
        gridOptions.initialize = function (options) {
            var initOptions;
            initOptions = $delegate.initialize(options);
            return initOptions;
        };
        //es is the language prefix you want
        i18nService.setCurrentLang('es');
        return gridOptions;
    }]);
}]);

app.config([
      '$animateProvider', function ($animateProvider) {
          $animateProvider.classNameFilter(/^((?!(ui-grid-menu)).)*$/);
      }
]);
//app.factory('httpErrorsInterceptor', function ($q, $rootScope, EventsDict, toaster, ngAnimate) {

//    function successHandler(response) {
//        return response;
//    }

//    function errorHandler(response) {
//        $rootScope.$broadcast(EventsDict.httpError, response.data.cause);
//        toaster.pop('error', 'Error de comunicación.', response.data.cause);
//        return $q.reject(response);
//    }

//    return function (httpPromise) {
//        return httpPromise.then(successHandler, errorHandler);
//    };

//});

//app.factory('httpErrorInterceptor', ['toaster', function(toaster) {
//    var httpErrorInterceptor = {
//        responseError: function(response) {
//            toaster.pop('error', 'error', response.data);
//            return response;
//        }
//    };
//    return httpErrorInterceptor;
//}]);

//app.config(['$httpProvider', function($httpProvider) {
//    $httpProvider.interceptors.push('httpErrorInterceptor');
//}]);

var ddlTurnosOptions = [{ text: 'Todos', value: '' }, { text: 'Mañana', value: 'M' }, { text: 'Tarde', value: 'T' }, { text: 'Noche', value: 'N' }];
var ddlDivisionesOptions = [{ text: 'Todas', value: '' }, { text: '1', value: '1' }, { text: '2', value: '2' }, { text: '3', value: '3' }, { text: '4', value: '4' }, { text: '5', value: '5' }, { text: '6', value: '6' }, { text: '7', value: '7' }, { text: '8', value: '8' }, { text: '9', value: '9' }, { text: '10', value: '10' }, { text: '11', value: '11' }, { text: '12', value: '12' }, { text: '13', value: '13' }, { text: '14', value: '14' }, { text: '15', value: '15' }];
var ddlCaracterOptions = [{ text: 'Titular', value: '1' }, { text: 'Interino', value: '2' }, { text: 'Suplente', value: '3' }, { text: 'Transitorio', value: '4' }, { text: 'Precario', value: '15' }, { text: 'AdHonorem', value: '16' }];
var ddlSiNoOptions = [{ text: 'Si', value: 'Si' }, { text: 'No', value: 'No' }];
var ddlTipoNotaFinalOptions = [{ text: 'Tribunal', value: 'Tribunal' }, { text: 'ColoquioPromocion', value: 'ColoquioPromocion' }, { text: 'Libre', value: 'Libre' }, { text: 'Promoción', value: 'Promoción' }, { text: 'Equivalencia', value: 'Equivalencia' }];
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
