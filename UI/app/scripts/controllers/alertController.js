app.controller('alertController',
[
    '$scope', 'alertService', function ($scope, alertService) {
        $scope.service = alertService;
    }
]);