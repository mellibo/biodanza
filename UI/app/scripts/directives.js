var directives = angular.module('directives', ['services', 'ngTable', 'ui.grid.autoResize', 'ui.grid.edit', 'ui.grid.selection', 'ui.bootstrap']);


directives.directive('uiSelectWrap', uiSelectWrap);

uiSelectWrap.$inject = ['$document', 'uiGridEditConstants'];

function uiSelectWrap($document, uiGridEditConstants) {
    return function link($scope, $elm, $attr) {
        $document.on('click', docClick);

        function docClick(evt) {
            if ($(evt.target).closest('.ui-select-container').size() === 0) {
                $scope.$emit(uiGridEditConstants.events.END_CELL_EDIT);
                $document.off('click', docClick);
            }
        }
    };
}

directives.directive('buscarMusica', ['$uibModal', 'NgTableParams', function ($uibModal, NgTableParams) {
    return {
        restrict: 'E'
        //, template: '<span ng-transclude></span><button type="button" style="float:right" ng-click="show()">...</button>'
        , replace: false
        //, transclude: true
        , scope: {
            selected: '='
            , 'onSelectedMusica': '&onSelectedMusica'// se ejecuta antes de que se actualice el valor
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

            var popupMusicaInstance = ['$scope', '$uibModalInstance', 'directiveScope', 'toaster', 'NgTableParams', function ($scope, $uibModalInstance, directiveScope, toaster, NgTableParams) {
                $scope.directiveScope = directiveScope;
                $scope.musicas = db.musicas;

                $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.musicas });

                $scope.musicaSeleccionada = {};

                $scope.model = {};
                $scope.model.select = true;
                $scope.model.ok = function (musica) {
                    $uibModalInstance.close(musica);
                };


                $scope.cancel = function () {
                    $uibModalInstance.dismiss('cancel');
                };
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

            var popupEjercicioInstance = ['$scope', '$uibModalInstance', 'directiveScope', 'toaster', 'NgTableParams', function ($scope, $uibModalInstance, directiveScope, toaster, NgTableParams) {
                $scope.directiveScope = directiveScope;
                $scope.ejercicios = db.ejercicios;

                $scope.tableParams = new NgTableParams({  }, { dataset: $scope.ejercicios });

                $scope.ejercicioSeleccionado = {};

                $scope.model = {};
                $scope.model.select = true;
                $scope.model.grupo = 0;
                $scope.model.buscar = "";
                $scope.filtrar = function (ejercicio) {
                    if ($scope.model.grupo !== 0 && $scope.model.grupo !== ejercicio.idGrupo) return false;
                    if ($scope.model.buscar === '') return true;
                    var searchString = $scope.model.buscar.toUpperCase();
                    if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
                    if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;
                    var ok = false;
                    angular.forEach(ejercicio.musicas,
                        function (value) {
                            if (ok) return;
                            if (value.nombre.toUpperCase().indexOf(searchString) > -1) ok = true;
                            if (value.interprete.toUpperCase().indexOf(searchString) > -1) ok = true;
                        });
                    return ok;
                };

                $scope.filtrarMusica = function (musica, ejercicio) {
                    if ($scope.model.buscar === '') return true;
                    var searchString = $scope.model.buscar.toUpperCase();
                    if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
                    if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;

                    if (musica.nombre.toUpperCase().indexOf(searchString) > -1) return true;
                    if (musica.interprete.toUpperCase().indexOf(searchString) > -1) return true;
                    return false;
                }


                $scope.mostrarEjercicio = function (ejercicio) {
                    $scope.model.ejercicio = ejercicio;
                    var modalInstance = $uibModal.open({
                        animation: true,
                        ariaLabelledBy: 'modal-title',
                        ariaDescribedBy: 'modal-body',
                        templateUrl: 'modalEjercicio.html',
                        controller: 'modalEjercicioController',
                        size: 'lg',
                        resolve: {
                            model: function () {
                                return $scope.model;
                            }
                        }
                    });
                }

                $scope.model.ok = function (ejercicio) {
                    $uibModalInstance.close(ejercicio);
                };


                $scope.cancel = function () {
                    $uibModalInstance.dismiss('cancel');
                };
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
                    templateUrl: viewBase + 'dialog.html'
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

/*
directives.directive('ngBlur', function () {
    return function (scope, elem, attrs) {
        elem.bind('blur', function () {
            scope.$apply(attrs.ngBlur);
        });
    };
});
*/
directives.directive('fileDownload', function () {
    return {
        restrict: 'AE',
        scope: {
            fileDownload: '=',
            fileName: '=',
        },

        link: function (scope, elem, atrs) {


            scope.$watch('fileDownload', function (newValue, oldValue) {

                if (newValue != undefined && newValue != null) {
                    console.debug('Downloading a new file');
                    var isFirefox = typeof InstallTrigger !== 'undefined';
                    var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
                    var isIE = /*@cc_on!@*/false || !!document.documentMode;
                    var isEdge = !isIE && !!window.StyleMedia;
                    var isChrome = !!window.chrome && !!window.chrome.webstore;
                    var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
                    var isBlink = (isChrome || isOpera) && !!window.CSS;

                    if (isFirefox || isIE || isChrome) {
                        if (isChrome) {
                            console.log('Manage Google Chrome download');
                            var url = window.URL || window.webkitURL;
                            var fileURL = url.createObjectURL(scope.fileDownload);
                            var downloadLink = angular.element('<a></a>');//create a new  <a> tag element
                            downloadLink.attr('href', fileURL);
                            downloadLink.attr('download', scope.fileName);
                            downloadLink.attr('target', '_self');
                            downloadLink[0].click();//call click function
                            url.revokeObjectURL(fileURL);//revoke the object from URL
                        }
                        if (isIE) {
                            console.log('Manage IE download>10');
                            window.navigator.msSaveOrOpenBlob(scope.fileDownload, scope.fileName);
                        }
                        if (isFirefox) {
                            console.log('Manage Mozilla Firefox download');
                            var url = window.URL || window.webkitURL;
                            var fileURL = url.createObjectURL(scope.fileDownload);
                            var a = elem[0];//recover the <a> tag from directive
                            a.href = fileURL;
                            a.download = scope.fileName;
                            a.target = '_self';
                            a.click();//we call click function
                        }


                    } else {
                        alert('SORRY YOUR BROWSER IS NOT COMPATIBLE');
                    }
                }
            });

        }
    }
})