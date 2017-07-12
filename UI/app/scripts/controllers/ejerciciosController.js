app.controller('ejerciciosController', ['$scope', '$window', '$location', 'toaster', 'contextService', function ($scope, $window, $location, toaster, contextService) {
    $scope.grupos = grupos;
    $scope.ejercicios = ejercicios;
    $scope.musicas = musicas;
    $scope.musicaEjercicio = musicaEjercicio;
    $scope.model = {};
    $scope.model.grupo = 0;
    $scope.model.buscar = "";
    $scope.model.pathMusica = 'D:\\Google Drive\\Biodanza\\Musica\\IBF\\';

    $scope.buscar = function() {
    }

    $scope.playMusica = function (musica) {
        $scope.musicaFile = $scope.model.pathMusica + musica.carpeta + '/' + musica.archivo;
    }
}]);
