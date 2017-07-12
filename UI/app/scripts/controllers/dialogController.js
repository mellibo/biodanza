

// Please note that $uibModalInstance  represents a modal window (instance) dependency.
// It is not the same as the $modal service used above.

app.controller('dialogController',['$scope', '$uibModalInstance' , 'items', function($scope, $uibModalInstance , items) {
    $scope.items = items;
    $scope.selected = {
        item: $scope.items[0]
    };

    $scope.ok = function() {
        $uibModalInstance .close($scope.selected.item);
    };

    $scope.cancel = function() {
        $uibModalInstance .dismiss('cancel');
    };
}]);