app.controller('ejerciciosController', ['$scope', '$rootScope', '$window', '$location', 'contextService', 'modelEjerciciosService', '$uibModal', function ($scope, $rootScope, $window, $location, contextService, modelEjerciciosService, $uibModal) {
    $scope.modelEjercicios = modelEjerciciosService;

    if (typeof contextService.config().pathMusica == "undefined" | contextService.config().pathMusica === "") {
        $location.path("/config");
    }
}]);

app.controller('modalEjercicioController', ['$scope', '$window', '$location', 'contextService', '$uibModalInstance', 'model', 'playerService', function ($scope, $window, $location, contextService, $uibModalInstance, model, playerService) {
    $scope.ejercicio = model.ejercicio;
    $scope.model = model;
    $scope.playMusica = function(musica) {
        playerService.playFile(musica);
    }
    $scope.aceptar = function () {
        $uibModalInstance.close();
    }
}]);

app.controller('musicasController', ['$scope', '$filter', '$location', 'contextService', 'modelMusicaService', '$uibModal', 'NgTableParams', function ($scope, $filter, $location, contextService, modelMusicaService, $uibModal, NgTableParams) {
    $scope.modelMusicas = modelMusicaService;
    $scope.isMobileOrTablet = contextService.isMobileOrTablet();
}]);

app.controller('configController', ['$scope', '$window', '$location', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, contextService, $uibModal, NgTableParams) {
    $scope.config = contextService.config();

    $scope.grabar = function () {
        if ($scope.config.pathMusica[$scope.config.pathMusica.length - 1] !== "/") $scope.config.pathMusica += "/";
        contextService.config($scope.config);
    }
}]);

app.controller('clasesController', ['$scope', '$window', '$location', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, contextService, $uibModal, NgTableParams) {
    $scope.clases = contextService.clases();
    $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.clases });

    $scope.vistaCompacta = true;
    $scope.nueva = function () {
        contextService.nuevaClase();
        $location.path('/clase/0');
    }

    $scope.delete = function (clase) {
        contextService.deleteClase(clase);
        $scope.tableParams.reload();
        //$scope.clases = contextService.clases();
    }

    $scope.exportarClases = function () {
        contextService.exportarClases();
    }

    $scope.importarClases = function (file) {
        contextService.importarClases(file.files[0]);
        $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.clases });
        $scope.tableParams.reload();
    }

    $scope.pickImportFile = function () {
        var fileElementAng = angular.element(document.querySelector('#fileImport'));
        var fileElement = fileElementAng[0];
        fileElement.click();
    }

    $scope.exportar = function (clase) {
        contextService.exportarClase(clase);
    }

    $scope.grabar = function() {
        contextService.saveClases();
    };

    $scope.fechaClase = { opened: false, open: function () { $scope.fechaClase.opened = true } };
    $scope.editarClase = function(clase) {
        var index = $scope.clases.indexOf(clase);
        if (index > -1) {
            $location.path('/clase/' + index);
        }
    }
}]);

app.controller('claseController', ['$scope', '$window', '$location', 'contextService', '$uibModal', 'NgTableParams', 'id', 'playerService', 'modelEjerciciosService', '$interval', function ($scope, $window, $location, contextService, $uibModal, NgTableParams, id, playerService, modelEjerciciosService, $interval) {
    $scope.clase = contextService.clases()[id];
    $scope.player = playerService;

    if (!$scope.clase) {
        $location.path("/clases");
        return;
    }

    angular.forEach($scope.clase.ejercicios,
        function(ejercicio) {
            contextService.calculaTiempoEjercicio(ejercicio);
        });

    $scope.tiempoTotalString = "";

    $scope.refreshTotalClase = function () {
        var total = moment.duration();
        angular.forEach($scope.clase.ejercicios,
            function (ejercicio) {
                if (!ejercicio.deshabilitado) {
                    contextService.calculaTiempoEjercicio(ejercicio);
                    total.add(ejercicio.tiempo);
                }
            });
        $scope.tiempoTotal = total;
        $scope.tiempoTotalString = moment(0, 's').add(total).format("H:mm:ss");
        $scope.horaFin = moment(0, 's').add(playerService.tiempoRestanteClase).format("H:mm:ss");
        $scope.clase.tiempo = total;
    }
    
    $scope.refreshTotalClase();

    $scope.exportar = function (clase) {
        contextService.exportarClase(clase);
    }


    playerService.clase = $scope.clase;
    $scope.horaFin = "";
    $scope.$watch('vistaPlayer',
        function (newVal, oldVal) {
            if ($scope.intervalHoraFin) $interval.cancel($scope.intervalHoraFin);
            if (newVal === true) {
                $scope.intervalHoraFin = $interval($scope.tiempoRestanteClase, 30000);
                $scope.tiempoRestanteClase();
            }
        });
    
    $scope.tiempoRestanteClase = function() {
        $scope.horaFin = moment().add(playerService.tiempoRestanteClase()).format("HH:mm");
        if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") $scope.$apply();
    }
    $scope.insertar = function (ejercicio) {
        contextService.insertarEjercicio($scope.clase, ejercicio);
    };
    $scope.rowClick = function(ejercicio) {
        if ($scope.vistaPlayer === false) return;
        $scope.playEjercicio(ejercicio);
    };
    $scope.selected = function (ejercicio) {
        return playerService.playIndex === ejercicio.nro -1 || (ejercicio.musica !== null && $scope.player.currentPlaying !== null && ejercicio.musica.nombre === $scope.player.currentPlaying.nombre);
    };
    $scope.vistaPlayer = false;
    $scope.playAll = function () {
        $scope.player.playContinuo = true;
        $scope.player.playAll();
    };
    $scope.mostrarEjercicio = modelEjerciciosService.mostrarEjercicio;

    $scope.tableParams = new NgTableParams({ count: 30 }, { counts: [], dataset: $scope.clase.ejercicios });

    $scope.grabar = function () {
        $scope.refreshTotalClase();
        contextService.saveClases();
    };

    $scope.fechaClase = { opened: false, open: function () { $scope.fechaClase.opened = true } };

    $scope.deleteEjercicioClase = function (ejercicio) {
        contextService.deleteEjercicioClase($scope.clase, ejercicio);
    }

    $scope.nuevoEjercicio = function () {
        contextService.nuevoEjercicioClase($scope.clase);
    }
    $scope.moveUp = function (ejercicio) {
        contextService.ejercicioMoveUp($scope.clase, ejercicio);
    }

    $scope.moveDown = function (ejercicio) {
        contextService.ejercicioMoveDown($scope.clase, ejercicio);
    }

    $scope.playEjercicio = function (ejercicio) {
        playerService.playEjercicio(ejercicio);
    };

    $scope.deleteEjercicio = function (ejercicio) {
        contextService.deleteEjercicio(ejercicio);
    }

    $scope.deleteMusica = function (ejercicio) {
        contextService.deleteMusica(ejercicio);
    }

    $scope.cerrar = function () {
        playerService.clase = undefined;
        $window.history.back();
    }

    $scope.detalleEjercicioClase = function(ejercicio) {
        var modalInstance = $uibModal.open({
            templateUrl: 'popupEjercicioClase.html'
                                    , controller: detalleEjercicioClaseController
                                    , size: 'md'
            //, windowClass: 'modalEjercicioClase'
                                    , resolve: {
                                        ejercicio: function () {
                                            return ejercicio;
                                        }
                                        ,parentScope: function () {
                                            return $scope;
                                        }
                                    }
        });
        modalInstance.result.then(function () {
        });
    };

    var detalleEjercicioClaseController = ['$scope', '$uibModalInstance', 'NgTableParams', 'contextService', 'modelMusicaService', 'ejercicio', 'parentScope', function ($scope, $uibModalInstance, NgTableParams, contextService, modelMusicaService, ejercicio, parentScope) {
        $scope.parentScope = parentScope;
        $scope.ejercicio = ejercicio;
        $scope.grabar = parentScope.grabar;

        $scope.aceptar = function () {
            $uibModalInstance.close();
        }
        $scope.playFile = function () {
            playerService.playFile($scope.ejercicio.musica, $scope.ejercicio);
        };

    }];

}]);

app.controller('headerController', ['$scope', '$rootScope', '$window', '$location', 'contextService', function ($scope, $rootScope, $window, $location, contextService) {
    $scope.isActive = function (route) {
        $scope.usuario = contextService.usuario;
        return $location.path().startsWith(route);
    };
}]);

app.controller('audioController', ['$scope', '$rootScope', '$window', '$location', 'contextService', 'playerService', function ($scope, $rootScope, $window, $location, contextService, playerService) {
    $scope.player = playerService;
    $scope.kk = function() {
        contextService.exportarClase(contextService.clases()[0]);
    };
}]);

app.controller('aboutController', ['$scope', function($scope) {
    $scope.mail = "biodanza" + "@" + "arsoft.com.ar";
}]);

app.controller('importMusicaController', ['$scope', 'contextService', 'NgTableParams', function ($scope, contextService, NgTableParams) {
    $scope.data = [];
    $scope.importarMusica = function (file) {
        contextService.importarMusicas(file.files[0], $scope.refresh);
            $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.data });
        $scope.tableParams.reload();
    }

    $scope.pickImportFile = function () {
        var fileElementAng = angular.element(document.querySelector('#fileImport'));
        var fileElement = fileElementAng[0];
        fileElement.click();
    }

    $scope.refresh = function (data) {
        $scope.data.splice(0, $scope.data.length);
        angular.forEach(data, function(item) { $scope.data.push(item); });
        $scope.tableParams.reload();
        if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") $scope.$apply();
    }
}]);
