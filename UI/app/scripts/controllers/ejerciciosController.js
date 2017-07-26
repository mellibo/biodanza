app.controller('ejerciciosController', ['$scope', '$rootScope', '$window', '$location', 'toaster', 'contextService', '$uibModal', function ($scope, $rootScope, $window, $location, toaster, contextService, $uibModal) {
    $scope.grupos = db.grupos;
    $scope.ejercicios = db.ejercicios;
    $scope.musicas = db.musicas;
    $scope.musicaSeleccionada = {};
    $scope.model = {};
    $scope.model.ejercicio = {};
    $scope.model.grupo = 0;
    $scope.model.buscar = "";
    if (typeof contextService.config().pathMusica == "undefined" | contextService.config().pathMusica ==="") {
        $location.path("/config");
    }

    $scope.model.pathMusica = contextService.config().pathMusica;
    $scope.model.playFile = function (musica) {
        contextService.play(musica);
    };

    $scope.filtrar = function(ejercicio) {
        if ($scope.model.grupo !== 0 && $scope.model.grupo !== ejercicio.idGrupo) return false;
        if ($scope.model.buscar === '') return true;
        var searchString = $scope.model.buscar.toUpperCase();
        if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
        if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;
        var ok = false;
        angular.forEach(ejercicio.musicas,
            function(value) {
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
}]);

app.controller('modalEjercicioController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModalInstance', 'model', function ($scope, $window, $location, toaster, contextService, $uibModalInstance, model) {
    $scope.ejercicio = model.ejercicio;
    $scope.model = model;
    $scope.playMusica = function(musica) {
        $scope.model.playFile(musica);
    }
    $scope.aceptar = function () {
        $uibModalInstance.close();
    }
}]);

app.controller('musicasController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, toaster, contextService, $uibModal, NgTableParams) {
    $scope.musicas = db.musicas;
    $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.musicas });
    $scope.musicaSeleccionada = {};
    $scope.model = {};
    $scope.model.pathMusica = contextService.config().pathMusica;
    $scope.model.buscar = "";
    $scope.model.playFile = function (musica) {
        contextService.play(musica);
    };
}]);

app.controller('configController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, toaster, contextService, $uibModal, NgTableParams) {
    $scope.config = contextService.config();

    $scope.grabar = function () {
        if ($scope.config.pathMusica[$scope.config.pathMusica.length - 1] !== "/") $scope.config.pathMusica += "/";
        contextService.config($scope.config);
    }
}]);

app.controller('clasesController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, toaster, contextService, $uibModal, NgTableParams) {
    $scope.clases = contextService.clases();
    $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.clases });

    $scope.nueva = function () {
        contextService.clase(contextService.nuevaClase());
        $location.path('/clase');
    }
}]);

app.controller('claseController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, toaster, contextService, $uibModal, NgTableParams) {
    $scope.clase = contextService.clase();
    $scope.tableParams = new NgTableParams({ count: 30 }, { counts: [], dataset: $scope.clase.ejercicios });


    $scope.moveUp = function (ejercicio) {
        contextService.ejercicioMoveUp($scope.clase, ejercicio);
    }

    $scope.moveDown = function (ejercicio) {
        contextService.ejercicioMoveDown($scope.clase, ejercicio);
    }

    $scope.deleteEjercicio = function (ejercicio) {
        ejercicio.ejercicio = null;
    }

    $scope.deleteMusica = function (ejercicio) {
        ejercicio.musica = null;
    }

    $scope.cerrar = function () {
        $window.history.back();
    }
}]);

app.controller('headerController', ['$scope', '$rootScope', '$window', '$location', 'toaster', 'contextService', function ($scope, $rootScope, $window, $location, toaster, contextService) {
    $scope.isActive = function (route) {
        $scope.usuario = contextService.usuario;
        return $location.path().startsWith(route);
    };
}]);

app.controller('audioController', ['$scope', '$rootScope', '$window', '$location', 'toaster', 'contextService', function ($scope, $rootScope, $window, $location, toaster, contextService) {
    $scope.play = function (musica) {
        $scope.musicaSeleccionada = musica;
        $scope.musicaFile = $scope.pathMusica + musica.coleccion + '/' + musica.carpeta + '/' + musica.archivo;
    }

    $scope.pathMusica = contextService.config().pathMusica;

    contextService.playFn = $scope.play;

    $scope.musicaSeleccionada = {};
    $scope.musicaFile = "";

}]);
