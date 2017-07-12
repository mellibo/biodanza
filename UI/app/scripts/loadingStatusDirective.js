var loadingStatus = angular.module('loadingStatus',['toaster']);

loadingStatus.directive('loadingStatusMessage', function() {
    return {
        link: function($scope, $element, attrs) {
            var show = function () {
                $element.css('display', 'block');
            };
            var hide = function() {
                $element.css('display', 'none');
            };
            $scope.$on('loadingStatusActive', show);
            $scope.$on('loadingStatusInactive', hide);
            hide();
        }
    };
});
 
loadingStatus.factory('loadingStatusInterceptor', ['$q', '$rootScope', 'toaster', function ($q, $rootScope, toaster) {
  var activeRequests = 0;
  var started = function() {
    if(activeRequests==0) {
      $rootScope.$broadcast('loadingStatusActive');
    }    
    activeRequests++;
  };
  var ended = function() {
    activeRequests--;
    if(activeRequests==0) {
      $rootScope.$broadcast('loadingStatusInactive');
    }
  };
  return {
    request: function(config) {
      started();
      return config || $q.when(config);
    },
    response: function(response) {
        ended();
      return response || $q.when(response);
    },
    responseError: function(rejection) {
        ended();
        toaster.pop('error', 'error', 'Error de comunicación: ' + rejection.data, 15000);
      return $q.reject(rejection);
    }
  };
}]);

loadingStatus.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.interceptors.push('loadingStatusInterceptor');
}]);

