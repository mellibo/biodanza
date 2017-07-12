app.controller('headerController',['$location', '$scope', 'contextService', function ($location, $scope, contextService) {
    $scope.isActive = function (route) {
        $scope.usuario = contextService.usuario;
        return $location.path().startsWith(route);
    };
    //contextService.usuario = contextService.usuario || { login: "---" };
    $scope.logoff = function () {
        $location.path("/acceso");
        contextService.usuario = undefined;
    }
}]);
