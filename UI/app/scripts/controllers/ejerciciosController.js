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
    $scope.modelMusicas = contextService.modelMusicas;
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

app.controller('claseController', ['$scope', '$window', '$location', 'contextService', '$uibModal', 'NgTableParams', 'id', function ($scope, $window, $location, contextService, $uibModal, NgTableParams, id) {
    $scope.clase = contextService.clases()[id];

    if (!$scope.clase) {
        $location.path("/clases");
        return;
    }

    //angular.forEach($scope.clase.ejercicios, function (ej) {
    //    ej.nombre = "";
    //});

    $scope.mostrarEjercicio = contextService.modelEjercicios.mostrarEjercicio;

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
