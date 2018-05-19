services.factory('loadJsService', ['$q', function ($q) {
    var service = {
        load: function (src, type) {
            var deferred = $q.defer();

            var head = document.getElementsByTagName('head')[0];
            var js = document.createElement("script");

            js.type = type || "text/javascript";
            js.src = src;
            js.onload = function (script) {
                console.log("loaded:" + src);
                deferred.resolve(js);
            }
            js.onerror = function (error) {
                console.log(error);
                deferred.reject(error);
            }
            head.appendChild(js);
            return deferred.promise;
        }
    };
    return service;
}]);

