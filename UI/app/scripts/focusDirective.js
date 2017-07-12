/*
<input type="text" focus-on="focusMe"/>
app.controller('MyCtrl', function($scope, focus) {
    focus('focusMe');
});
*/
app.directive('focusOn', function() {
    return function(scope, elem, attr) {
        scope.$on('focusOn', function(e, name) {
            if(name === attr.focusOn) {
                elem[0].focus();
            }
        });
    };
});

app.factory('focus',['$rootScope', '$timeout', function ($rootScope, $timeout) {
    return function(name) {
        $timeout(function (){
            $rootScope.$broadcast('focusOn', name);
        });
    }
}]);