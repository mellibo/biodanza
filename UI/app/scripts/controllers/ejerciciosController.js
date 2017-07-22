app.controller('ejerciciosController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModal', function ($scope, $window, $location, toaster, contextService, $uibModal) {
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
        $scope.musicaSeleccionada = musica;
        $scope.musicaFile = $scope.model.pathMusica + musica.coleccion + "/" + musica.carpeta + '/' + musica.archivo;
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

    //$scope.playMusica = function (musica) {
    //    $scope.musicaFile = $scope.model.pathMusica + musica.carpeta + '/' + musica.archivo;
    //}


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
        $scope.musicaSeleccionada = musica;
        $scope.musicaFile = $scope.model.pathMusica + musica.coleccion + "/" + musica.carpeta + '/' + musica.archivo;
    };
}]);

app.controller('configController', ['$scope', '$window', '$location', 'toaster', 'contextService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, toaster, contextService, $uibModal, NgTableParams) {
    $scope.config = contextService.config();

    $scope.grabar = function () {
        if ($scope.config.pathMusica[$scope.config.pathMusica.length - 1] !== "/") $scope.config.pathMusica += "/";
        contextService.config($scope.config);
    }
}]);
