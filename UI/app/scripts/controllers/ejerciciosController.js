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

app.controller('claseController', ['$scope', '$window', '$location', 'contextService', '$uibModal', 'NgTableParams', 'id', 'playerService', 'modelEjerciciosService', function ($scope, $window, $location, contextService, $uibModal, NgTableParams, id, playerService, modelEjerciciosService) {
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
                total.add(ejercicio.tiempo);
            });
        $scope.tiempoTotal = total;
        $scope.tiempoTotalString = moment(0, 's').add(total).format("H:mm:ss");
    }

    $scope.refreshTotalClase();

    $scope.grabar = function () {
        contextService.saveClases();
    };

    $scope.selected = function (ejercicio) {
        return (ejercicio.musica !== null && $scope.player.currentPlaying !== null) && ejercicio.musica.nombre === $scope.player.currentPlaying.musica.nombre;
    };
    $scope.vistaPlayer = false;
    $scope.playAll = function () {
        playerService.playList.splice(0, playerService.playList.length);
        angular.forEach($scope.clase.ejercicios, function (item) {
            if (item.musica !== null) playerService.playList.push(item);
        });
        playerService.playAll();
    };
    $scope.mostrarEjercicio = modelEjerciciosService.mostrarEjercicio;

    $scope.tableParams = new NgTableParams({ count: 30 }, { counts: [], dataset: $scope.clase.ejercicios });

    $scope.grabar = function () {
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
                                    }
        });
        modalInstance.result.then(function () {
        });
    };

    var detalleEjercicioClaseController = ['$scope', '$uibModalInstance', 'NgTableParams', 'contextService', 'modelMusicaService', 'ejercicio', function ($scope, $uibModalInstance, NgTableParams, contextService, modelMusicaService, ejercicio) {
        $scope.ejercicio = ejercicio;
        $scope.aceptar = function () {
            $uibModalInstance.close();
        }
        $scope.playFile = function () {
            playerService.playFile($scope.ejercicio.musica, { iniciarSegundos: $scope.ejercicio.iniciarSegundos });
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

