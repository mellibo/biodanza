var redirectToLogin = angular.module('redirectToLogin', []);
 
redirectToLogin.factory('redirectToLoginInterceptor',['$q', '$rootScope', '$window', function ($q, $rootScope, $window) {
  return {
    response: function(response) {
        if (typeof response.data ==="string" && response.data.indexOf("<title>Ingreso</title>") > 0)
        {
            $window.location = "/#/acceso";
        }
      return response || $q.when(response);
    }
  };
}]);

redirectToLogin.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.interceptors.push('redirectToLoginInterceptor');
}]);

