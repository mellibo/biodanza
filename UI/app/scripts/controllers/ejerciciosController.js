app.controller('ejerciciosController', ['$scope', '$rootScope', '$window', '$location', 'contextService', '$uibModal', function ($scope, $rootScope, $window, $location, contextService, $uibModal) {
    $scope.modelEjercicios = contextService.modelEjercicios;

    if (typeof contextService.config().pathMusica == "undefined" | contextService.config().pathMusica === "") {
        $location.path("/config");
    }
}]);

app.controller('modalEjercicioController', ['$scope', '$window', '$location', 'contextService', '$uibModalInstance', 'model', function ($scope, $window, $location, contextService, $uibModalInstance, model) {
    $scope.ejercicio = model.ejercicio;
    $scope.model = model;
    $scope.playMusica = function(musica) {
        $scope.model.playFile(musica);
    }
    $scope.aceptar = function () {
        $uibModalInstance.close();
    }
}]);

app.controller('musicasController', ['$scope', '$filter', '$location', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $filter, $location, contextService, $uibModal, NgTableParams) {
    $scope.musicas = db.musicas;
    $scope.data = db.musicas;
    $scope.ejercicios = db.ejercicios;
    $scope.model = { selectedEjercicio : "" };
    $scope.ejerciciosNombre = [];
    angular.forEach(db.ejercicios, function(value) {
        $scope.ejerciciosNombre.push(value.nombre);
    });

    $scope.refreshGrid = function () {
         $scope.tableParams.reload();
    };

    $scope.tableParams = new NgTableParams({ count: 15 },
    {
        total: $scope.musicas.length,
        getData: function (params) {
            // use build-in angular filter
            var orderedData = params.sorting ?
                    $filter('orderBy')($scope.data, params.orderBy()) :
                    $scope.data;
            orderedData = params.filter ?
                    $filter('filter')(orderedData, params.filter()) :
                    orderedData;
            if ($scope.model.selectedEjercicio) {
                var arrEjs = $filter('filter')(db.ejercicios, { nombre: $scope.model.selectedEjercicio });
                var arrFiltrado = [];
                for (var i = 0; i < arrEjs.length; i++) {
                    var eje = arrEjs[i];
                    var filtroMusicas = eje.musicas;
                    var arrEjMusica = $filter('filter')(orderedData,
                        function (value, index, array) {
                            var fil = $filter('filter')(filtroMusicas,
                                { coleccion: value.coleccion, nroCd: value.nroCd, nroPista: value.nroPista }, true);
                            //console.log(value.coleccion + value.nroCd + '-' +value.nroPista + ':' + ret);
                            if (typeof fil === "undefined") return false;
                            return fil.length === 1;;
                        });
                    angular.extend(arrFiltrado, arrEjMusica);
                    console.log(arrFiltrado);
                }
                orderedData = arrFiltrado;
            }
            $scope.musicas = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());

            params.total(orderedData.length); // set total for recalc pagination
            return $scope.musicas;
        }
    });
    $scope.musicaSeleccionada = {};
    $scope.model = {};
    $scope.model.pathMusica = contextService.config().pathMusica;
    $scope.model.buscar = "";
    $scope.model.playFile = function (musica) {
        contextService.play(musica);
    };
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
        contextService.clase(contextService.nuevaClase());
        $location.path('/clase');
    }

    $scope.delete = function (clase) {
        contextService.deleteClase(clase);
        $scope.tableParams.reload();
        //$scope.clases = contextService.clases();
    }

    $scope.grabar = function() {
        contextService.saveClases();
    };

    $scope.fechaClase = { opened: false, open: function () { $scope.fechaClase.opened = true } };
    $scope.editarClase = function(clase) {
        contextService.clase(clase);
        $location.path('/clase');
    }
}]);

app.controller('claseController', ['$scope', '$window', '$location', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, contextService, $uibModal, NgTableParams) {
    $scope.clase = contextService.clase();

    if (!$scope.clase) {
        $location.path("/clases");
        return;
    }

    $scope.mostrarEjercicio = contextService.modelEjercicios.mostrarEjercicio;

    $scope.tableParams = new NgTableParams({ count: 30 }, { counts: [], dataset: $scope.clase.ejercicios });

    $scope.grabar = function () {
        contextService.saveClases();
    };
    $scope.fechaClase = { opened: false, open: function () { $scope.fechaClase.opened = true } };

    
    $scope.moveUp = function (ejercicio) {
        contextService.ejercicioMoveUp($scope.clase, ejercicio);
    }

    $scope.moveDown = function (ejercicio) {
        contextService.ejercicioMoveDown($scope.clase, ejercicio);
    }

    $scope.playFile = function (musica) {
        contextService.play(musica);
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
}]);

app.controller('headerController', ['$scope', '$rootScope', '$window', '$location', 'contextService', function ($scope, $rootScope, $window, $location, contextService) {
    $scope.isActive = function (route) {
        $scope.usuario = contextService.usuario;
        return $location.path().startsWith(route);
    };
}]);

app.controller('audioController', ['$scope', '$rootScope', '$window', '$location', 'contextService', function ($scope, $rootScope, $window, $location, contextService) {
    $scope.play = function (musica) {
        if (musica === null) return;
        $scope.musicaSeleccionada = musica;
        $scope.musicaFile = contextService.config().pathMusica + musica.coleccion + '/' + musica.carpeta + '/' + musica.archivo;
    }

    contextService.playFn = $scope.play;

    $scope.musicaSeleccionada = {};
    $scope.musicaFile = "";

}]);
