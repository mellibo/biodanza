
services.factory('loaderService', ['loadJsService', '$q', function (loadJsService, $q) {
    var coleccionesPromises = [];
    db.musicas = [];

    function loadCols() {
        angular.forEach(db.colecciones,
            function (col) {
                var promise = loadJsService.load("app/data/musica_" + col + '.js');
                promise.then(function () {
                    var musicas = eval('db.musica_' + col);
                    Array.prototype.push.apply(db.musicas, musicas);
                });
                coleccionesPromises.push(promise);
            });
    }

    var service = {
        colecciones: function () {
            console.log("colecciones");
            loadCols();
            var promise = $q.all(coleccionesPromises);
            promise.then(function() {
                angular.forEach(db.musicas, addMusica);
            });
            return promise;
        }
    };

    var maxIdMusica = 1000000;
    function setIdMusica(musica) {
        maxIdMusica++;
        musica.idMusica = maxIdMusica;
    }

    function addMusica(musica, index) {
        if (typeof index === 'undefined') {
            db.musicas.push(musica);
            index = db.musicas.length - 1;
        }
        var str = "db.musicas.x" + musica.idMusica + " = db.musicas[ " + index + "];";
        eval(str);
        if (musica.idMusica === 0 || typeof musica.idMusica === "undefined") setIdMusica(musica);
        if (maxIdMusica < musica.idMusica) maxIdMusica = musica.idMusica;
    }

    angular.forEach(db.ejercicios,
        function (ejercicio, index) {
            var str = "db.ejercicios.x" + ejercicio.idEjercicio + " = db.ejercicios[ " + index + "];";
            eval(str);
        });

    function loadClases() {
        angular.forEach(biodanzaClases,
            function (value) {
                if (typeof value.V === 'undefined') value.V = false;
                if (typeof value.A === 'undefined') value.A = false;
                if (typeof value.C === 'undefined') value.C = false;
                if (typeof value.S === 'undefined') value.S = false;
                if (typeof value.T === 'undefined') value.T = false;
                angular.forEach(value.ejercicios,
                    function (ej) {
                        if (typeof ej.iniciarSegundos === "undefined" || ej.iniciarSegundos === null) ej.iniciarSegundos = 0;
                        if (typeof ej.finalizarSegundos === "undefined") ej.finalizarSegundos = null;
                        if (typeof ej.segundosInicioProgresivo === "undefined") ej.segundosInicioProgresivo = null;
                        if (typeof ej.segundosFinProgresivo === "undefined") ej.segundosFinProgresivo = null;
                        if (typeof ej.pauseEmpalme === "undefined") ej.pauseEmpalme = null;
                        if (typeof ej.volumen === "undefined") ej.volumen = 100;
                        if (typeof ej.minutosAdicionales === "undefined") ej.minutosAdicionales = 0;
                        if (typeof ej.cantidadRepeticiones === "undefined") ej.cantidadRepeticiones = 1;
                        if (typeof ej.deshabilitado === "undefined") ej.deshabilitado = false;
                        if (ej.musica !== null) {
                            var musica = eval("db.musicas.x" + ej.musica.idMusica);
                            if (typeof musica === "undefined" || musica.coleccion !== ej.musica.coleccion || musica.nroCd !== ej.musica.nroCd || musica.nroPista !== ej.musica.nroPista) {
                                var musicas = $filter('filter')(db.musicas, { coleccion: ej.musica.coleccion, nroCd: ej.musica.nroCd, nroPista: ej.musica.nroPista }, true);
                                if (musicas.length === 1) musica = musicas[0];
                            }
                            if (!musica) {
                                console.log("musica no encontrada:" + ej.musica.nombre);
                            }
                            if (musica) {
                                ej.musica = musica;
                            }
                        }
                        if (ej.ejercicio !== null) {
                            var ejercicio = eval("db.ejercicios.x" + ej.ejercicio.idEjercicio);
                            if (typeof ejercicio === "undefined") {
                                var ejercicios = $filter('filter')(db.ejercicios, { nombre: ej.ejercicio.nombre }, true);
                                if (ejercicios.length === 1) ejercicio = ejercicios[0];
                            }
                            if (ejercicio) {
                                ej.ejercicio = ejercicio;
                            }
                        }
                    });
            });
    }
    return service;
}]);
