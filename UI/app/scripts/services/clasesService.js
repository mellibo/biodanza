services.factory('clasesService',
[
    '$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', '$location', '$rootScope', 'loaderService', 'downloadService',
    function ($q, $localStorage, $uibModal, NgTableParams, $filter, $location, $rootScope, loaderService, downloadService) {
        var service = {};
        var biodanzaClases = null;


        service.calculaTiempoEjercicio = function (ejercicio) {
            if (ejercicio.musica === null) {
                ejercicio.tiempo = moment.duration(ejercicio.minutosAdicionales, 'm');
                return;
            }
            var tiempo = moment.duration(ejercicio.musica.duracion);
            if (ejercicio.finalizarSegundos > 0) tiempo = moment.duration(ejercicio.finalizarSegundos, 's');
            if (ejercicio.iniciarSegundos > 0) tiempo.subtract(ejercicio.iniciarSegundos, 's');
            if (ejercicio.pauseEmpalme > 0) tiempo.add(ejercicio.pauseEmpalme, 's');
            var total = moment.duration();
            for (var i = 1; i <= ejercicio.cantidadRepeticiones; i++) {
                total.add(tiempo);
            }
            if (ejercicio.minutosAdicionales > 0) total.add(ejercicio.minutosAdicionales, 'm');
            ejercicio.tiempo = total;
            return;
        }

        service.saveClases = function () {
            $localStorage.biodanzaClases = biodanzaClases;
        }

        function nuevoEjercicio(nro) {
            return angular.copy({
                nro: nro,
                ejercicio: null,
                musica: null,
                consigna: null,
                cometarios: null,
                nombre: "",
                volumen: 100,
                iniciarSegundos: null,
                finalizarSegundos: null,
                segundosInicioProgresivo: null,
                segundosFinProgresivo: null,
                pauseEmpalme: null,
                cantidadRepeticiones: 1,
                minutosAdicionales: 0,
                deshabilitado: false
            });
        }

        service.nuevoEjercicioClase = function (clase) {
            var ej = nuevoEjercicio(clase.ejercicios.length + 1);
            clase.ejercicios.push(ej);
            service.saveClases();
        }

        service.nuevaClase = function () {
            var clase = angular.copy({ titulo: 'Nueva Clase', fechaCreacion: new Date(), fechaClase: new Date(), comentarios: '', ejercicios: [] });
            for (var f = 1; f < 11; f++) {
                service.nuevoEjercicioClase(clase);
            }
            biodanzaClases.unshift(clase);
            service.saveClases();
            return clase;
        }

        service.nuevaMusica = function () {
            return angular.copy({
                "coleccion": 'personal',
                "nroCd": 1,
                "nroPista": 1,
                "nombre": "",
                "interprete": "",
                "duracion": "",
                "archivo": "",
                "carpeta": "",
                "lineas": ""
            });

        }

        service.deleteClase = function (clase) {
            var index = biodanzaClases.indexOf(clase);
            if (index > -1) {
                biodanzaClases.splice(index, 1);
            }
            service.saveClases();
        }

        service.ejercicioMoveUp = function (clase, ejercicio) {
            if (ejercicio.nro === 1) return;
            var x = clase.ejercicios[ejercicio.nro - 2];
            clase.ejercicios[ejercicio.nro - 2] = clase.ejercicios[ejercicio.nro - 1];
            clase.ejercicios[ejercicio.nro - 1] = x;
            var nro = ejercicio.nro;
            clase.ejercicios[nro - 2].nro = nro - 1;
            clase.ejercicios[nro - 1].nro = nro;
            service.saveClases();
        }

        service.deleteEjercicioClase = function (clase, ejercicio) {
            if (ejercicio.nro === 1) return;
            var index = clase.ejercicios.indexOf(ejercicio);
            if (index > -1) {
                clase.ejercicios.splice(index, 1);
            }
            for (var i = index; i < clase.ejercicios.length; i++) {
                clase.ejercicios[i].nro = i + 1;
            }
        }

        service.ejercicioMoveDown = function (clase, ejercicio) {
            if (ejercicio.nro === clase.ejercicios.length) return;
            var x = clase.ejercicios[ejercicio.nro];
            clase.ejercicios[ejercicio.nro] = clase.ejercicios[ejercicio.nro - 1];
            clase.ejercicios[ejercicio.nro - 1] = x;
            var nro = ejercicio.nro;
            clase.ejercicios[nro - 1].nro = nro;
            clase.ejercicios[nro].nro = nro + 1;
            service.saveClases();
        }

        service.insertarEjercicio = function (clase, ejercicio) {
            var nro = ejercicio.nro;
            clase.ejercicios.splice(nro - 1, 0, nuevoEjercicio(nro));
            for (var i = nro - 1; i < clase.ejercicios.length; i++) {
                clase.ejercicios[i].nro = i + 1;
            }
            service.saveClases();
        }

        service.deleteEjercicio = function (ejercicio) {
            ejercicio.ejercicio = null;
            service.saveClases();
        };

        service.deleteMusica = function (ejercicio) {
            ejercicio.musica = null;
            service.saveClases();
        };

        service.clases = function () {
            biodanzaClases = $localStorage.biodanzaClases;
            if (biodanzaClases == null) {
                biodanzaClases = [claseEjemplo];
            }

            return biodanzaClases;
        };
        service.clases();

        service.importarClases = function (file) {
            var reader = new FileReader();
            reader.onloadend = function (evt) {
                if (evt.target.readyState === FileReader.DONE) {
                    console.log(evt.target.result);
                    var json = eval(evt.target.result.substring(evt.target.result.indexOf('[')));
                    angular.forEach(json,
                        function (item) {
                            biodanzaClases.unshift(item);
                        });
                    loaderService.loadClases();
                }
            };
            reader.readAsText(file);
        };

        var buildExpClase = function (clase) {
            var ejercicios = [];
            angular.forEach(clase.ejercicios,
                function (value) {
                    var ej = {
                        comentarios: value.comentarios,
                        consigna: value.consigna,
                        nombre: value.nombre,
                        nro: value.nro,
                        iniciarSegundos: value.iniciarSegundos,
                        finalizarSegundos: value.finalizarSegundos,
                        segundosInicioProgresivo: value.segundosInicioProgresivo,
                        segundosFinProgresivo: value.segundosFinProgresivo,
                        pauseEmpalme: value.pauseEmpalme,
                        volumen: value.volumen,
                        minutosAdicionales: value.minutosAdicionales,
                        cantidadRepeticiones: value.cantidadRepeticiones,
                        deshabilitado: value.deshabilitado,
                        ejercicio: value.ejercicio === null
                            ? null
                            : {
                                nombre: value.ejercicio.nombre,
                                grupo: value.ejercicio.grupo
                            },
                        musica: value.musica === null
                            ? null
                            : {
                                archivo: value.musica.archivo,
                                carpeta: value.musica.carpeta,
                                coleccion: value.musica.coleccion,
                                interprete: value.musica.interprete,
                                nombre: value.musica.nombre,
                                nroCd: value.musica.nroCd,
                                nroPista: value.musica.nroPista
                            }
                    };
                    ejercicios.push(ej);
                });
            var claseExp = {
                titulo: clase.titulo,
                fechaCreacion: clase.fechaCreacion,
                fechaClase: clase.fechaClase,
                comentarios: clase.comentarios,
                ejercicios: ejercicios,
                V: clase.V,
                A: clase.A,
                C: clase.C,
                S: clase.S,
                T: clase.T
            }
            return claseExp;
        };

        service.exportarClases = function () {
            var clases = [];
            angular.forEach(service.clases(), function (value) {
                var clase = buildExpClase(value);
                clases.push(clase);
            });
            downloadService.downloadJson(clases, "clases biodanza.bio");
        };


        service.exportarClase = function (clase) {
            var clases = [];
            var claseExp = buildExpClase(clase);
            clases.push(clase);

            downloadService.downloadJson(clases, claseExp.titulo + ".bio");
        };
        return service;
    }
]);