var directives = angular.module('directives', ['services', 'ngTable']);

directives.directive('buscarMusica', ['$uibModal', 'NgTableParams', function ($uibModal, NgTableParams) {
    return {
        restrict: 'E'
        //, template: '<span ng-transclude></span><button type="button" style="float:right" ng-click="show()">...</button>'
        , replace: false
        //, transclude: true
        , scope: {
            selected: '='
            , 'onSelectedMusica': '&onSelectedMusica'// se ejecuta antes de que se actualice el valor
            , ejercicio : '='
        }
        , link: function(scope, element, attrs) {
            element.parent().bind('click', function () {
                //console.log(attrs);
                //scope.selected = '=selected';
                scope.show();
            });
        }
        , controller: ['$scope', '$rootScope', function ($scope, $rootScope) {
            $scope.show = function () {
                $scope.cancion= '';
                $scope.selected = $scope.selected || { cancion: "" };
                $scope.idMusica = 0;
                $scope.interprete = '';
                $scope.ejercicio = $scope.ejercicio || {};
                var modalInstance = $uibModal.open({
                    templateUrl: 'popupBuscarMusica.html'
                                                    , controller: popupMusicaInstance
                                                    , size: 'lg'
                                                    , resolve: {
                                                        directiveScope: function () {
                                                            return $scope;
                                                        }
                                                    }
                });
                modalInstance.result.then(function (selectedItem) {
                    $scope.selected = selectedItem;
                    $rootScope.$broadcast('buscarMusicaSelected', selectedItem);
                    if ($scope.onSelectedMusica()) $scope.onSelectedMusica()(selectedItem); // se ejecuta antes de que se actualice el valor
                });

            };

            var popupMusicaInstance = ['$scope', '$uibModalInstance', 'directiveScope', 'NgTableParams', 'contextService', function ($scope, $uibModalInstance, directiveScope, NgTableParams, contextService) {
                $scope.directiveScope = directiveScope;

                $scope.modelMusicas = contextService.modelMusicas;
                $scope.modelMusicas.ejercicio = directiveScope.ejercicio;
                $scope.modelMusicas.select = true;
                $scope.modelMusicas.$uibModalInstance = $uibModalInstance;
            }];
        }]
    };
}]);

directives.directive('buscarEjercicio', ['$uibModal', 'NgTableParams', function ($uibModal, NgTableParams) {
    return {
        restrict: 'E'
        //, template: '<span ng-transclude></span><button type="button" style="float:right" ng-click="show()">...</button>'
        , replace: false
        //, transclude: true
        , scope: {
            selected: '='
            , 'onSelectedEjercicio': '&onSelectedEjercicio'// se ejecuta antes de que se actualice el valor
        }
        , link: function(scope, element, attrs) {
            element.parent().bind('click', function () {
                //console.log(attrs);
                //scope.selected = '=selected';
                scope.show();
            });
        }
        , controller: ['$scope', '$rootScope', function ($scope, $rootScope) {
            $scope.show = function () {
                $scope.cancion= '';
                $scope.selected = $scope.selected || { cancion: "" };
                $scope.idMusica = 0;
                $scope.interprete = '';
                $scope.ejercicio = {}
                var modalInstance = $uibModal.open({
                    templateUrl: 'popupBuscarEjercicio.html'
                                                    , controller: popupEjercicioInstance
                                                    , size: 'lg'
                                                    , resolve: {
                                                        directiveScope: function () {
                                                            return $scope;
                                                        }
                                                    }
                });
                modalInstance.result.then(function (selectedItem) {
                    $scope.selected = selectedItem;
                    $rootScope.$broadcast('buscarEjercicioSelected', selectedItem);
                    if ($scope.onSelectedEjercicio()) $scope.onSelectedEjercicio()(selectedItem); // se ejecuta antes de que se actualice el valor
                });
            };

            var popupEjercicioInstance = ['$scope', '$uibModalInstance', 'directiveScope', 'contextService', 'NgTableParams', function ($scope, $uibModalInstance, directiveScope, contextService, NgTableParams) {
                $scope.directiveScope = directiveScope;

                $scope.cancel = function () {
                    $uibModalInstance.dismiss('cancel');
                };

                $scope.modelEjercicios = contextService.modelEjercicios;
                $scope.modelEjercicios.select = true;
                $scope.modelEjercicios.$uibModalInstance = $uibModalInstance;

            }];
        }]
    };
}]);

directives.directive('arsoftConfirmation',['$uibModal', function ($uibModal) {
    return {
        restrict : 'A'
        , template: ''
        , priority: 1
        , terminal: true
        , scope: true
        , replace: false
        //, transclude: true
     , link: function (scope, element, attrs) {
            return element.bind('click', function (e) {
                scope.message = attrs.arsoftConfirmation || "Esta seguro?";
                scope.title = attrs.arsoftConfirmationTitle || "Confirmar Acción";
                scope.accion = attrs.ngClick;
                scope.open();
            });
        }
        , controller:['$scope', '$uibModal', '$log', function ($scope, $uibModal, $log) {

            $scope.title = "Cofirmar Acción";
            $scope.message = 'Esta seguro?';
            $scope.size = 'lg';
            $scope.onOk = function(){};
            $scope.open = function() {
                var modalInstance = $uibModal.open({
                    templateUrl: 'dialog.html'
                    , controller: ModalInstanceCtrl
                    //size: 'sm',
                    ,resolve: {
                        parentScope: function() {
                            return $scope;
                        }
                    }
                });

                //modalInstance.result.then(function(selectedItem) {
                //    $scope.selected = selectedItem;
                //}, function() {
                //    $log.info('Modal dismissed at: ' + new Date());
                //});
            };
            
            var ModalInstanceCtrl =['$scope', '$uibModalInstance' , 'parentScope', function ($scope, $uibModalInstance , parentScope) {

                $scope.message = parentScope.message;
                $scope.title = parentScope.title;
                $scope.ok = function () {
                    $uibModalInstance .close();
                    parentScope.$eval(parentScope.accion);
                };

                $scope.cancel = function () {
                    $uibModalInstance .dismiss('cancel');
                };
            }];
        }]
    };
}]);

directives.directive('arsoftInputModal', ['$uibModal', function ($uibModal) {
    return {
        restrict : 'A'
        , template: ''
        , priority: 1
        , terminal: true
        , scope: {
            arsoftInputModel: '='
        }
        , replace: false
        //, transclude: true
     , link: function (scope, element, attrs) {
            return element.bind('click', function (e) {
                scope.model.label = attrs.arsoftInputLabel || "Ingrese valor:";
                scope.model.title = attrs.arsoftInputTitle || "";
                scope.model.inputModel = attrs.arsoftInputModel;
                scope.model.open();
            });
        }
        , controller:['$scope', '$uibModal', '$log', function ($scope, $uibModal, $log) {
            $scope.model = {};
            $scope.model.title = "";
            $scope.model.label = 'Ingrese Valor';
            $scope.size = 'sm';
            $scope.model.input = $scope.arsoftInputModel;
            $scope.model.open = function() {
                var modalInstance = $uibModal.open({
                    templateUrl: 'inputModal.html'
                    , controller: ModalInstanceCtrl
                    ,size: 'sm'
                    ,resolve: {
                        parentScope: function() {
                            return $scope;
                        }
                    }
                });

                modalInstance.result.then(function (inputValue) {
                    $scope.arsoftInputModel = inputValue;
                });
            };

            var ModalInstanceCtrl =['$scope', '$uibModalInstance' , 'parentScope', function ($scope, $uibModalInstance , parentScope) {
                $scope.model = {};
                $scope.model.label = parentScope.model.label;
                $scope.model.title = parentScope.model.title;
                $scope.model.input = parentScope.arsoftInputModel;
                $scope.ok = function () {
                    $uibModalInstance.close($scope.model.input);
                };

                $scope.cancel = function () {
                    $uibModalInstance .dismiss('cancel');
                };
            }];
        }]
    };
}]);

directives.directive('ngEnter', [function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.ngEnter);
                });
                event.preventDefault();
            }
        });
    };
}]);

