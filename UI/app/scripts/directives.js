var directives = angular.module('directives', ['services', 'ui.grid.autoResize', 'ui.grid.edit', 'ui.grid.selection', 'ui.bootstrap']);


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

directives.directive('cabredBuscarAlumno',['alumnoService', 'uiGridConstants', '$uibModal', function (alumnoService, uiGridConstants, $uibModal) {
    return {
        restrict: 'E'
        //, template: '<span ng-transclude></span><button type="button" style="float:right" ng-click="show()">...</button>'
        , replace: false
        //, transclude: true
        , scope: {
            selected: '='
            , 'onSelectedAlumno': '&onSelectedAlumno'// se ejecuta antes de que se actualice el valor
        }
        , link: function(scope, element, attrs) {
            element.parent().bind('click', function () {
                //console.log(attrs);
                //scope.selected = '=selected';
                scope.show();
            });
        }
        , controller:['$scope', '$rootScope', function ($scope, $rootScope) {
            $scope.show = function () {
                $scope.apellido = '';
                $scope.selected = $scope.selected || { legajo: "" };
                $scope.legajo = $scope.selected.legajo || '';
                $scope.documento = '';
                var modalInstance = $uibModal.open({
                    templateUrl: viewBase + 'popupBuscarAlumno.html'
                                                    , controller: popupBuscarAlumnoInstance
                                                    , size: 'lg'
                                                    , resolve: {
                                                        directiveScope: function () {
                                                            return $scope;
                                                        }
                                                    }
                });
                modalInstance.result.then(function (selectedItem) {
                    $scope.selected = selectedItem;
                    $rootScope.$broadcast('buscarAlumnoSelected', selectedItem);
                    if ($scope.onSelectedAlumno()) $scope.onSelectedAlumno()(selectedItem); // se ejecuta antes de que se actualice el valor
                });

            };

            var popupBuscarAlumnoInstance = ['$scope', 'alumnoService', '$uibModalInstance' , 'directiveScope', 'toaster', function ($scope, alumnoService, $uibModalInstance , directiveScope, toaster) {
                $scope.directiveScope = directiveScope;
                $scope.data = [];
                $scope.buscar = function (apellido, legajo, documento) {
                    alumnoService.search(apellido, legajo, documento)
                        .then(function(response) {
                            if (response.data.ok) {
                                $scope.data = response.data.list;
                            } else {
                                toaster.pop('error', 'Busca Alumno', 'Error: ' + response.data.mensaje);
                            }
                        });
                };

                $scope.gridApi = {};

                $scope.gridFocus = function() {
                    $scope.gridOptions.selectRow(0, true);
                    $(".ngViewport").focus();
                };
                
                $scope.$watch('directiveScope.apellido', function () {
                    if ($scope.directiveScope.apellido.length > 2) {
                        $scope.buscar($scope.directiveScope.apellido, '', '');
                    } else {
                        $scope.data = [];
                    }
                });

                $scope.$watch('directiveScope.legajo', function () {
                    if ($scope.directiveScope.legajo.length > 2) {
                        $scope.buscar('', $scope.directiveScope.legajo, '');
                    } else {
                        $scope.data = [];
                    }
                });

                $scope.$watch('directiveScope.documento', function () {
                    $scope.buscar('', '', $scope.directiveScope.documento);
                    //if ($scope.directiveScope.documento.length > 2) {
                    //} else {
                    //    $scope.data = [];
                    //}
                });

                $scope.aceptar = function () {
                    if ($scope.gridApi.selection.getSelectedRows().length !== 1) return;
                    $uibModalInstance.close($scope.gridApi.selection.getSelectedRows()[0]);
                };

                $scope.gridOptions = {
                    data: 'data',
                    selectionRowHeaderWidth: 35,
                    enableFullRowSelection: true,
                    enableRowSelection: true
                    , enableColumnResizing: true
                    , enableRowHeaderSelection: true
                    , rowSelection: true
                    , multiSelect: false
                    , i18n: 'es'
                    //, selectedItems: []
                    , columnDefs: [
                    { field: 'legajo', displayName: 'Legajo', width: '100' }
                    , { field: 'carrera.carrera', displayName: 'Carrera', width: '150' }
                    , { field: 'nombreCompleto', displayName: 'Nombre', width: '300' }
                    , { field: 'documento', displayName: 'documento', width: '120' }
                    ]
                };

                $scope.gridOptions.onRegisterApi = function (gridApi) {
                    $scope.gridApi = gridApi;
                };

                $scope.cancel = function () {
                    $uibModalInstance .dismiss('cancel');
                };
            }];
        }]
    };
}]);

directives.directive('cabredBuscarCatedra',['catedraService', 'uiGridConstants', 'carreraService', '$log', '$uibModal', function (catedraService, uiGridConstants, carreraService, $log, $uibModal) {
    return {
        restrict: 'E'
        , scope: {
            selected: '='
            , 'onSelectedCatedra': '&onSelectedCatedra'
            , vigente : "=soloVigentes"
            , tipo : "=tipoCatedra"
        }
        , link: function (scope, element, attrs) {
            element.parent().bind('click', function () {
                scope.show();
            });
        }
        , controller:['$scope', '$rootScope', function ($scope, $rootScope) {
            $scope.show = function () {
                $scope.carrera = { id: '21' };
                $scope.turno = '';
                $scope.division = '';
                var modalInstance = $uibModal.open({
                                                    templateUrl: viewBase + 'popupBuscarCatedra.html'
                                                    , controller: popupBuscarCatedraInstance
                                                    ,size: 'lg'
                                                    , resolve: {
                                                        directiveScope: function () {
                                                            return $scope;
                                                        }
                                                    }
                });
                modalInstance.result.then(function (selectedItem) {
                    $scope.selected = selectedItem;
                    $rootScope.$broadcast('buscarCatedraSelected', selectedItem);
                    if ($scope.onSelectedCatedra()) $scope.onSelectedCatedra()(selectedItem); // se ejecuta antes de que se actualice el valor
                });

            };

            var popupBuscarCatedraInstance =['$scope', 'catedraService', '$uibModalInstance' , 'directiveScope', 'toaster', 'carreraService', function ($scope, catedraService, $uibModalInstance , directiveScope, toaster, carreraService) {
                carreraService.all().then(function(data) {
                    $scope.carreras = data.data;
                    $scope.directiveScope.carrera = findByAttr($scope.carreras, 'id', directiveScope.carrera.id || '');
                });
                $scope.directiveScope = directiveScope;
                //$scope.turno = directiveScope.turno || '';
                //$scope.division = directiveScope.division || '';
                $scope.turnos = ddlTurnosOptions;
                $scope.divisiones = ddlDivisionesOptions;
                $scope.data = [];
                $scope.buscar = function (carrera, turno, division) {
                    catedraService.search(carrera, turno, division, null, $scope.directiveScope.vigente, null, $scope.directiveScope.tipo)
                        .then(function (response) {
                            if (response.data.ok) {
                                $scope.data = response.data.list;
                            } else {
                                toaster.pop('error', 'Busca Catedra', 'Error: ' + response.data.mensaje);
                            }
                        });
                };

                $scope.gridApi = {};

                $scope.gridFocus = function () {
                    $scope.gridOptions.selectRow(0, true);
                    $(".ngViewport").focus();
                };

                $scope.$watch('directiveScope.carrera.id', function () {
                    $scope.buscar($scope.directiveScope.carrera.id, $scope.directiveScope.turno, $scope.directiveScope.division);
                });

                $scope.$watch('directiveScope.turno', function () {
                    $scope.buscar($scope.directiveScope.carrera.id, $scope.directiveScope.turno, $scope.directiveScope.division);
                });

                $scope.$watch('directiveScope.division', function () {
                    $scope.buscar($scope.directiveScope.carrera.id, $scope.directiveScope.turno, $scope.directiveScope.division);
                });

                $scope.aceptar = function () {
                    if ($scope.gridApi.selection.getSelectedRows().length !== 1) return;
                    $uibModalInstance.close($scope.gridApi.selection.getSelectedRows()[0]);
                };

                $scope.gridOptions = {
                    data: 'data',
                    //showFooter: true
                    selectionRowHeaderWidth: 35,
                    enableFullRowSelection :true,
                    enableRowSelection: true
                    , enableColumnResizing: true
                    ,enableRowHeaderSelection :true
                    ,rowSelection : true
                    , multiSelect: false
                    //, enableColumnReordering: true
                    //, enableColumnResize: true
                    //, showColumnMenu: true
                    //, showHeader: true
                    //, showFilter: false
                    //, selectedItems: []
                    , columnDefs: [
                    { field: 'id', displayName: 'Nro', width: '50' }
                    , { field: 'carrera.carrera', displayName: 'Carrera', width: '100' }
                    , { field: 'asignatura.nombre', displayName: 'Asignatura', width: '200' }
                    , { field: 'turno', displayName: 'Turno', width: '55' }
                    , { field: 'division', displayName: 'Div.', width: '50' }
                    , { field: 'titular.apellido', displayName: 'Titular', width: '200', cellTemplate: '<div class="ngCellText">{{row.entity.titular.apellido + ", " + row.entity.titular.nombre}}</div>' }
                    , { field: 'docenteActual.apellido', displayName: 'Docente Actual', width: '200', cellTemplate: '<div class="ngCellText">{{row.entity.docenteActual.apellido + ", " + row.entity.docenteActual.nombre}}</div>' }
                    ]
                };

                $scope.gridOptions.onRegisterApi = function (gridApi) {
                    $scope.gridApi = gridApi;
                    gridApi.selection.on.rowSelectionChanged($scope, function (row) {
                        var msg = 'row selected ' + row.isSelected;
                        $log.log(msg);
                    });

                    gridApi.selection.on.rowSelectionChangedBatch($scope, function (rows) {
                        var msg = 'rows changed ' + rows.length;
                        $log.log(msg);
                    });
                };

                $scope.cancel = function () {
                    $uibModalInstance .dismiss('cancel');
                };
            }];
        }]
    };
}]);

directives.directive('cabredBuscarAgente',['agenteService', '$uibModal', '$rootScope', function (agenteService, $uibModal, $rootScope) {
    return {
        restrict: 'E'
        //, template: '<span ng-transclude></span><button type="button" style="float:right" ng-click="show()">...</button>'
        , replace: true
        //, transclude: true
         , scope: {
             selected: '='
            , 'onSelectedAgente': '&onSelectedAgente'// se ejecuta antes de que se actualice el valor
         }
        , link: function (scope, element, attrs) {
            element.parent().bind('click', function () {
                scope.show();
            });
        }
        , controller:['$scope', function ($scope) {
            $scope.show = function () {
                $scope.apellido = '';
                $scope.nombre = '';
                $scope.selected = $scope.selected || { documento : "" };
                $scope.documento = $scope.selected.documento || "";
                var modalInstance = $uibModal.open({
                                                    templateUrl: viewBase + 'popupBuscarAgente.html'
                                                    , controller: popupBuscarAgenteInstance
                                                    ,size: 'lg'
                                                    , resolve: {
                                                        directiveScope: function () {
                                                            return $scope;
                                                        }
                                                    }
                });
                modalInstance.result.then(function(selectedItem) {
                    $scope.selected = selectedItem;
                    //$scope.$apply();
                    $rootScope.$broadcast('buscarAgenteSelected', selectedItem);
                    if ($scope.onSelectedAgente()) $scope.onSelectedAgente()(selectedItem); // se ejecuta antes de que se actualice el valor
                });
            };

            var popupBuscarAgenteInstance =['$scope', 'agenteService', '$uibModalInstance' , 'directiveScope', 'toaster', function ($scope, agenteService, $uibModalInstance , directiveScope, toaster) {
                $scope.directiveScope = directiveScope;
                $scope.data = [];
                $scope.buscar = function (apellido, nombre, documento) {
                    agenteService.find(apellido, nombre, documento)
                        .then(function (response) {
                            if (response.data.ok) {
                                $scope.data = response.data.list;
                            } else {
                                toaster.pop('error', 'Busca Agente', 'Error: ' + response.data.mensaje);
                            }
                        });
                };

                $scope.gridApi = {};

                $scope.gridFocus = function () {
                    $scope.gridOptions.selectRow(0, true);
                    $(".ngViewport").focus();
                };

                $scope.$watch('directiveScope.apellido', function () {
                    if ($scope.directiveScope.apellido.length > 2) {
                        $scope.buscar($scope.directiveScope.apellido, '', '');
                    } else {
                        $scope.data = [];
                    }
                });

                $scope.$watch('directiveScope.nombre', function () {
                    if ($scope.directiveScope.nombre.length > 2) {
                        $scope.buscar($scope.directiveScope.apellido, $scope.directiveScope.nombre, '');
                    } else {
                        $scope.data = [];
                    }
                });

                $scope.$watch('directiveScope.documento', function () {
                    $scope.buscar('', '', $scope.directiveScope.documento);
                });


                $scope.aceptar = function () {
                    if ($scope.gridApi.selection.getSelectedRows().length !== 1) return;
                    $uibModalInstance.close($scope.gridApi.selection.getSelectedRows()[0]);
                };

                $scope.gridOptions = {
                    data: 'data',
                    selectionRowHeaderWidth: 35,
                    enableFullRowSelection: true,
                    enableRowSelection: true
                    , enableColumnResizing: true
                    , enableRowHeaderSelection: true
                    , rowSelection: true
                    , multiSelect: false
                    , columnDefs: [
                        { field: 'id', displayName: 'Nro', width: '50' }
                        , { field: 'apellido', displayName: 'Apellido', width: '200' }
                        , { field: 'nombre', displayName: 'Nombre', width: '200' }
                        , { field: 'documento', displayName: 'Documento', width: '100' }
                        , { field: 'mail', displayName: 'Mail', width: '200' }
                    ]
                };

                $scope.gridOptions.onRegisterApi = function (gridApi) {
                    $scope.gridApi = gridApi;
                };

                $scope.cancel = function () {
                    $uibModalInstance .dismiss('cancel');
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