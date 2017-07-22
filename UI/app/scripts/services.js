var services = angular.module('services', []);

services.factory('contextService', ['$q', '$localStorage', function ($q, $localStorage) {
    var context = {};

    function getStream(url ,params) {
        console.log("RUNNING");
        var deferred = $q.defer();

        $http({
            url: '../downloadURL/',
            method: "GET",//you can use also GET or POST
            data: params,
            headers: { 'Content-type': 'application/json' },
            responseType: 'arraybuffer',//THIS IS IMPORTANT
        })
           .success(function (data) {
               console.debug("SUCCESS");
               deferred.resolve(data);
           }).error(function (data) {
               console.error("ERROR");
               deferred.reject(data);
           });

        return deferred.promise;
    };

    context.config = function(cfg) {
        if (typeof cfg == 'undefined') {
            var config = $localStorage.biodanzaConfig;
            if (config == null) {
                config = { pathMusica:''}
            }
            return config;
        }
        $localStorage.biodanzaConfig = cfg;
    };

    return context;
}]);

