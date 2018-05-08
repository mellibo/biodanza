
services.factory('loaderService', ['loadJsService', '$q', '$localStorage', '$filter', 'alertService', function (loadJsService, $q, $localStorage, $filter, alertService) {
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
            if (coleccionesPromises.length > 0) {
                return $q.all(coleccionesPromises);
            }
            console.log("colecciones");
            loadCols();
            var promise = $q.all(coleccionesPromises);
            promise.then(function() {
                angular.forEach(db.musicas, addMusica);
            });
            return promise;
        }
        , config : function(cfg) {
            if (typeof cfg == 'undefined') {
                var config = $localStorage.biodanzaConfig;
                if (config == null) {
                    config = { pathMusica: 'musica/' }
                }
                return config;
            }
            $localStorage.biodanzaConfig = cfg;
        },
        getEjercicio : function(nombre) {
            var ejercicios = $filter('filter')(db.ejercicios, { nombre: nombre }, true);
            if (ejercicios.length === 1) return ejercicios[0];
            return undefined;
        },
        getMusicaById : function(idMusica) {
            var str = "db.musicas." + idMusica;
            return eval(str);
        },
        getMusicaByColCdPista: function (col, cd, pista) {
            var idMusica = "x" + col + "_" + "cd" + "_" + pista;
            return service.getMusicaById(idMusica);
        }
    };

    //var maxIdMusica = 1000000;
    function setIdMusica(musica) {
        if (typeof musica.idMusica !== "undefined") musica.oldId = musica.idMusica;
        musica.idMusica = "x" + musica.coleccion + "_" + musica.nroCd + "_" + musica.nroPista;
    }

    function addMusica(musica, index) {
        if (typeof index === 'undefined') {
            db.musicas.push(musica);
            index = db.musicas.length - 1;
        }
        var str = "db.musicas.x" + musica.coleccion + "_" + musica.nroCd + "_" + musica.nroPista + " = db.musicas[ " + index + "];";
        eval(str);
        setIdMusica(musica);
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
                            var musica = service.getMusicaById(ej.musica.idMusica);
                            if (typeof musica === "undefined" || musica.coleccion !== ej.musica.coleccion || musica.nroCd !== ej.musica.nroCd || musica.nroPista !== ej.musica.nroPista) {
                                musica = service.getMusicaByColCdPista(musica.coleccion, musica.nroCd, musica.nroPista);
                            }
                            if (!musica) {
                                console.log("musica no encontrada:" + ej.musica.nombre);
                                alertService.addAlert("danger", "musica no encontrada:" + ej.musica.nombre + "." + musica.idMusica || "");
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
