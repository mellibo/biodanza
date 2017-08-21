var services = angular.module('services', []);

function addMusicasAEjercicio(ejercicio) {
    if (typeof ejercicio.musicas !== "undefined") return;
    ejercicio.musicas = [];
    angular.forEach(ejercicio.musicasId,
        function (value) {
            var musica = eval("db.musicas.x" + value);
            ejercicio.musicas.push(musica);
        });
}

services.factory('contextService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', function ($q, $localStorage, $uibModal, NgTableParams, $filter) {
    var context = {};

    angular.forEach(db.musicas,
        function(musica, index) {
            var str = "db.musicas.x" + musica.idMusica + " = db.musicas[ " + index + "];";
            eval(str);
        });

    context.calculaTiempoEjercicio = function (ejercicio) {
        if (ejercicio.musica === null) {
            ejercicio.tiempo = moment.duration(ejercicio.minutosAdicionales, 'm');
            return;
        }
        var tiempo = moment.duration(ejercicio.musica.duracion);
        if (ejercicio.finalizarSegundos > 0) tiempo = moment.duration(ejercicio.finalizarSegundos, 's');
        if (ejercicio.iniciarSegundos > 0) tiempo.subtract(ejercicio.iniciarSegundos, 's');
        var total = moment.duration();
        for (var i = 1; i <= ejercicio.cantidadRepeticiones; i++) {
            total.add(tiempo);
        }
        if (ejercicio.minutosAdicionales > 0) total.add(ejercicio.minutosAdicionales, 'm');
        ejercicio.tiempo = total;
        return;
    }

    context.config = function (cfg) {
        if (typeof cfg == 'undefined') {
            var config = $localStorage.biodanzaConfig;
            if (config == null) {
                config = { pathMusica:'musica/'}
            }
            return config;
        }
        $localStorage.biodanzaConfig = cfg;
    };

    context.saveClases = function() {
        $localStorage.biodanzaClases = biodanzaClases;
    }
    context.nuevoEjercicioClase = function(clase) {
        var ej = angular.copy({ nro: clase.ejercicios.length + 1, ejercicio: null, musica: null, consigna: null, cometarios: null, nombre: "", iniciarSegundos : null, finalizarSegundos : null, segundosInicioProgresivo: null, segundosFinProgresivo: null, empalmarTemaSiguiente: false, cantidadRepeticiones : 1, minutosAdicionales: 0});
        clase.ejercicios.push(ej);
        context.saveClases();
    }

    context.nuevaClase = function() {
        var clase = angular.copy({ titulo: 'Nueva Clase', fechaCreacion: new Date(), fechaClase: new Date(), comentarios: '', ejercicios: [] });
        for (var f = 1; f < 11; f++) {
            context.nuevoEjercicioClase(clase);
        }
        biodanzaClases.unshift(clase);
        context.saveClases();
        return clase;
    }

    context.deleteClase = function (clase) {
        var index = biodanzaClases.indexOf(clase);
        if (index > -1) {
            biodanzaClases.splice(index, 1);
        }
        context.saveClases();
    }

    context.ejercicioMoveUp = function (clase, ejercicio) {
        if (ejercicio.nro === 1) return;
        var x = clase.ejercicios[ejercicio.nro - 2];
        clase.ejercicios[ejercicio.nro - 2] = clase.ejercicios[ejercicio.nro - 1];
        clase.ejercicios[ejercicio.nro - 1] = x;
        var nro = ejercicio.nro;
        clase.ejercicios[nro - 2].nro = nro - 1;
        clase.ejercicios[nro - 1].nro = nro;
        context.saveClases();
    }

    context.deleteEjercicioClase = function (clase, ejercicio) {
        if (ejercicio.nro === 1) return;
        var index = clase.ejercicios.indexOf(ejercicio);
        if (index > -1) {
            clase.ejercicios.splice(index, 1);
        }
        for (var i = index; i < clase.ejercicios.length; i++) {
            clase.ejercicios[i].nro = i + 1;
        }
    }

    context.ejercicioMoveDown = function (clase, ejercicio) {
        if (ejercicio.nro === clase.ejercicios.length) return;
        var x = clase.ejercicios[ejercicio.nro];
        clase.ejercicios[ejercicio.nro] = clase.ejercicios[ejercicio.nro - 1];
        clase.ejercicios[ejercicio.nro - 1] = x;
        var nro = ejercicio.nro;
        clase.ejercicios[nro - 1].nro = nro;
        clase.ejercicios[nro].nro = nro + 1;
        context.saveClases();
    }

    context.deleteEjercicio = function(ejercicio) {
        ejercicio.ejercicio = null;
        context.saveClases();
    };

    context.deleteMusica = function(ejercicio) {
        ejercicio.musica = null;
        context.saveClases();
    };

    context.clases = function () {
        biodanzaClases = $localStorage.biodanzaClases;
        if (biodanzaClases == null) {
            biodanzaClases = [];
            biodanzaClases = [context.nuevaClase()];
        }
            
        return biodanzaClases;
    };

    angular.forEach(context.clases(),
        function(value) {
            angular.forEach(value.ejercicios,
                function(ej) {
                    if (typeof ej.iniciarSegundos === "undefined" || ej.iniciarSegundos === null) ej.iniciarSegundos = 0;
                    if (typeof ej.finalizarSegundos === "undefined") ej.finalizarSegundos = null;
                    if (typeof ej.segundosInicioProgresivo === "undefined") ej.segundosInicioProgresivo = null;
                    if (typeof ej.segundosFinProgresivo === "undefined") ej.segundosFinProgresivo = null;
                    if (typeof ej.empalmarTemaSiguiente === "undefined") ej.empalmarTemaSiguiente = false;
                    if (typeof ej.minutosAdicionales === "undefined") ej.minutosAdicionales = 0;
                    if (typeof ej.cantidadRepeticiones === "undefined") ej.cantidadRepeticiones = 1;
                    if (ej.musica !== null && ej.musica.duracion === "00:00:00") {
                        var musica = eval("db.musicas.x" +  ej.musica.idMusica);
                        if (musica) {
                            ej.musica.duracion = musica.duracion;
                        }
                    }
                });
        });
    context.saveClases();

    var buildExpClase = function(clase) {
        var ejercicios = [];
        angular.forEach(clase.ejercicios,
            function(value) {
                var ej = {
                    comentarios: value.comentarios,
                    consigna: value.consigna,
                    nombre: value.nombre,
                    nro: value.nro,
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
            ejercicios: ejercicios
        }
        return claseExp;
    };

    var downloadJson = function (obj, filename) {
        var data = "text/json;charset=utf-8," + angular.toJson(obj, true);
        var blob = new Blob([data], { type: 'text/json' }),
            e = document.createEvent('MouseEvents'),
            a = document.createElement('a');

        a.download = filename;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
        e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);

    };

    context.exportarClases = function() {
        var clases = [];
        angular.forEach(context.clases(), function(value) {
            var clase = buildExpClase(value);
            clases.push(clase);
        });
        downloadJson(clases, "clases biodanza.bio");
    };


    context.exportarClase = function (clase) {
        var claseExp = buildExpClase(clase);
        downloadJson(claseExp, claseExp.titulo + ".bio");
    };

    return context;
}]);

services.factory('playerService',
[
    'contextService', '$document', '$rootScope', '$interval', '$filter', '$timeout',
function (contextService, $document, $rootScope, $interval, $filter, $timeout) {

        var audioElementAng = angular.element(document.querySelector('#audioControl'));
        var audio = audioElementAng[0];

        var service = {
            play: function() {
                if (audio.currentTime === 0 &&
                    service.currentPlaying === service.clase.ejercicios[service.playIndex].musica) {
                    service.playEjercicio(service.clase.ejercicios[service.playIndex]);
                    return;
                }
                audio.play();
            },
            pause: function() {
                audio.pause();
            },
            clase: null,
            tiempoRestanteClase: function() {
                if (!service.clase) return moment.duration(0, 's');
                if (service.playIndex < 0) return service.clase.tiempo;
                var total = moment.duration();
                for (var i = service.playIndex + 1; i < service.clase.ejercicios.length; i++) {
                    total.add(service.clase.ejercicios[i].tiempo);
                }
                var ejActual = service.clase.ejercicios[service.playIndex];

                var tiempoEjercicio = moment.duration(ejActual.tiempo);
                if (ejActual.minutosAdicionales > 0) tiempoEjercicio.subtract(ejActual.minutosAdicionales, 'm');
                tiempoEjercicio.subtract(audio.currentTime, 's');
                total.add(tiempoEjercicio);
                return total;
            },
            playIndex: -1,
            playFromList: function() {
                //if (service.playList.length - 1 < service.playIndex) service.playIndex = 0;
                if (service.clase.ejercicios.length - 1 >= service.playIndex) {
                    audio.repeatCount = undefined;
                    service.playFile(service.clase.ejercicios[service.playIndex].musica,
                        service.clase.ejercicios[service.playIndex]);
                }
            },
            playNext: function() {
                if (service.playIndex === service.clase.ejercicios.length - 1) return;
                service.playIndex++;
                service.playFromList();
            },
            playPrevious: function() {
                if (service.playIndex === 0) return;
                service.playIndex--;
                service.playFromList();
            },
            finProgresivo: function(segundos) {
                service.segundosFinProgresivo = segundos;
            },
            duration: 0,
            durationString: function() {
                return (new Date(service.duration * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
            },
            currentTime: 0,
            currentTimeString: function() {
                return (new Date(service.currentTime * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
            },
            state: "",
            errorMessage: "",
            currentPlaying: null,
            finalizarLeftPx: null,
            stop: function() {
                service.pause();
                audio.currentTime = 0;
            },
            message: "",
            playEjercicio: function(ejercicio) {
                service.playIndex = ejercicio.nro - 1;
                service.playFromList();
            },
            playFile: function(musica, ejercicio) {
                audio.volume = 1;
                audio.ejercicio = ejercicio;
                service.tiempoRestanteClase();
                service.currentPlaying = musica;
                service.message = "";
                service.segundosFinProgresivo = 0;
                service.finalizarLeftPx = null;
                if (ejercicio && ejercicio.finalizarSegundos) {
                    var progress = angular.element(document.querySelector('#playerProgress'))[0];
                    var duration = moment.duration(musica.duracion).asSeconds();
                    service.finalizarLeftPx = ejercicio.finalizarSegundos * progress.clientWidth / duration;
                }
                if (musica === null) {
                    service.stop();
                    return;
                }
                if (service.playIndex !== -1 &&
                    service.playIndex !== 0 &&
                    service.clase.ejercicios[service.playIndex].musica !== musica) {
                    service.playIndex = -1;
                }
                if (service.clase) {
                    var musicaSearch = $filter('filter')(service.clase.ejercicios, { musica: musica });
                    if (musicaSearch && musicaSearch.length > 0) {
                        service.playIndex = musicaSearch[0].nro - 1;
                    }
                }
                if (ejercicio && (ejercicio.segundosInicioProgresivo || 0) > 0) {
                    audio.volume = 0;
                    audio.volumeStep = 1 / (ejercicio.segundosInicioProgresivo * 1000 / 200);
                    audio.intervalInicioVolume = $interval(function() {
                            if (audio.volume + audio.volumeStep >= 1) {
                                $interval.cancel(audio.intervalInicioVolume);
                                audio.intervalInicioVolume = undefined;
                                audio.volume = 1;
                                return;
                            }
                            audio.volume += audio.volumeStep;
                        },
                        200);
                }
                if (typeof audio.repeatCount === "undefined") audio.repeatCount = 1;
                audio.src = contextService.config().pathMusica +
                    musica.coleccion +
                    '/' +
                    musica.carpeta +
                    '/' +
                    musica.archivo;
                if (ejercicio) audio.currentTime = ejercicio.iniciarSegundos;
                service.message = musica.coleccion +
                    '-' +
                    musica.nroCd +
                    '-' +
                    musica.nroPista +
                    ' ' +
                    musica.nombre +
                    '(' +
                    musica.interprete +
                    '). ';
                if (ejercicio) {
                    service.message += ejercicio.nombre;
                    if (ejercicio.ejercicio) service.message += ' (' + ejercicio.ejercicio.nombre + ').';
                }
                try {
                    audio.play();
                } catch (e) {
                    service.error = e.message;
                }
            },
            playAll: function() {
                if (service.clase.ejercicios.length < 1) return;
                service.playIndex = 1;
                service.playPrevious();
            },
            setCurrentTime: function(value) {
                audio.currentTime = value;
            },
            progressClick: function($event) {
                if (typeof $event === "undefined") return;
                var progress = angular.element(document.querySelector('#playerProgress'))[0];
                service.setCurrentTime($event.offsetX * service.duration / progress.clientWidth);
            },
            changeState: function(newState) {
                console.log(newState);
                switch (newState) {
                case "playing":
                    //service.startStateLoop();
                    break;
                case "ended":
                    if (service.clase) {
                        service.tiempoRestanteClase();
                        if (newState === "ended" &&
                            service.playIndex > -1 &&
                            service.clase.ejercicios[service.playIndex].cantidadRepeticiones >
                            audio.repeatCount) {
                            audio.repeatCount++;
                            service.playFile(service.clase.ejercicios[service.playIndex].musica,
                                service.clase.ejercicios[service.playIndex]);
                            return;
                        }
                    }
                    if (!audio.ended) {
                        service.stop();
                    }
                    if (service
                        .playIndex >
                        -1 &&
                        service.clase.ejercicios[service.playIndex].empalmarTemaSiguiente) service.playNext();
                case "pause":
                case "error":
                    service.stopStateLoop();
                    break;
                default:
                }
                service.state = newState;
            },
            startStateLoop: function() {
                service.stopStateLoop();
                service.intervalState = $interval(service.updateState, 1000);
            },
            stopStateLoop: function() {
                if (service.intervalState) $interval.cancel(service.intervalState);
            },
            updateState: function() {
                service.currentTime = audio.currentTime;
                service.duration = audio.duration || 0;
                if ((service.segundosFinProgresivo || 0) > 0) {
                    activarFinProgresivo(service.segundosFinProgresivo);
                    service.segundosFinProgresivo = 0;
                }
                if ($rootScope.$$phase !== "$apply" && $rootScope.$$phase !== "$digest") $rootScope.$apply();
                if (service.clase === undefined || service.playIndex < 0) return;
                if (service.playIndex > -1 &&
                    (service.clase.ejercicios[service.playIndex].finalizarSegundos || 99999) <= service.currentTime) {
                    //service.stop();
                    service.changeState("ended");
                }
                var duracionTotal = (service.clase.ejercicios[service.playIndex].finalizarSegundos || 0) > 0
                    ? service.clase.ejercicios[service.playIndex].finalizarSegundos
                    : service.duration;
                if ((service.clase.ejercicios[service.playIndex].segundosFinProgresivo || 0) > 0) {
                    if (service.currentTime >= duracionTotal - service.clase.ejercicios[service.playIndex].segundosFinProgresivo &&
                        typeof audio.intervalFinProgresivo === "undefined") {
                        activarFinProgresivo(service.clase.ejercicios[service.playIndex].segundosFinProgresivo);
                    }
                }
            }
        };

        function activarFinProgresivo(segundosFinProgresivo) {
            audio.volumeStepFin = 1 / (segundosFinProgresivo * 1000 / 200);
            audio.intervalFinProgresivo = $interval(function() {
                    if (audio.volume - audio.volumeStepFin >= 0) audio.volume -= audio.volumeStepFin;
                },
                200);
            $timeout(function() {
                    $interval.cancel(audio.intervalFinProgresivo);
                    audio.intervalFinProgresivo = undefined;
                    service.stop();
                },
                segundosFinProgresivo * 1000 - 0.3);
        }

        audioElementAng.bind('play',
            function () {
                service.changeState("playing");
                service.startStateLoop();
            });
        audioElementAng.bind('playing',
            function () {
                service.changeState("playing");
            });
        audioElementAng.bind('pause',
            function () {
                service.changeState("pause");
            });
        audioElementAng.bind('ended',
            function () {
                service.changeState("ended");
                service.playNext();
                //$rootScope.$apply();
            });
        audioElementAng.bind('durationchange',
            function () {
                service.duration = audio.duration;
                //if (indexMusicas < musicas.length - 1) {
                //    updateDuracion();
                //}
                //console.log(service.duration);
                //$rootScope.$apply();
            });
        audioElementAng.bind('timeupdate',
            function () {
                service.currentTime = audio.currentTime;
                //console.log(service.currentTime);
            });
        audioElementAng.bind('error',
            function ($event) {
                service.changeState("error");
                service.errorMessage = "error: " + $event.srcElement.error.message;
                service.message = service.errorMessage;
                //$rootScope.$apply();
                console.log($event);
                //if (indexMusicas < musicas.length - 1) {
                //    updateDuracion();
                //    return;
                //}

            });
/*
        var musicas = $filter('filter')(db.musicas, { duracion: "00:00:00" });
        var indexMusicas = 0;

       audio.src = contextService.config().pathMusica +
                    musicas[0].coleccion +
                    '/' +
                    musicas[0].carpeta +
                    '/' +
                    musicas[0].archivo;
       function updateDuracion() {
           if (audio.duration > 0) {
               var time = moment(0, 's').add(moment.duration(audio.duration, 's'))
                   .format("HH:mm:ss");
               console.log("UPDATE Musica SET Duracion = cast('" +
                   time +
                   "' as time) WHERE IdMusica = " +
                   musicas[indexMusicas].idMusica);
           }
            indexMusicas++;
            audio.src = contextService.config().pathMusica +
                musicas[indexMusicas].coleccion +
                '/' +
                musicas[indexMusicas].carpeta +
                '/' +
                musicas[indexMusicas].archivo;
        }*/
        return service;
    }
]);

services.factory('modelEjerciciosService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService) {

    var service = {
        refreshGrid: function () {
            service.tableParams.reload();
        },
        tableParams: new NgTableParams({ count: 15 },
        {
            total: db.ejercicios.length,
            getData: function (params) {
                var orderedData =  db.ejercicios;
                if (service.buscar !== "" || service.grupo !== 0) {
                    orderedData = $filter('filter')(orderedData,
                        function (ejercicio, index, array) {
                            if (service.grupo !== 0 &&
                                service.grupo !== ejercicio.idGrupo) return false;
                            if (service.buscar === '') return true;
                            var searchString = service.buscar.toUpperCase();
                            if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
                            if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;
                            var ok = false;
                            addMusicasAEjercicio(ejercicio);
                            angular.forEach(ejercicio.musicas,
                                function (musica) {
                                    if (ok) return;
                                    if (musica.nombre.toUpperCase().indexOf(searchString) > -1) ok = true;
                                    if (musica.interprete.toUpperCase().indexOf(searchString) > -1) ok = true;
                                });
                            return ok;
                        });
                }
                var ejercicios = orderedData.slice((params
                        .page() -
                        1) *
                    params.count(),
                    params.page() * params.count());
                angular.forEach(ejercicios, function(value) { addMusicasAEjercicio(value); });
                
                params.total(orderedData.length);
                return ejercicios;
            }
        })
    };
    service.select = false;
    service.grupos = db.grupos;
    //service.ejercicios = db.ejercicios;
    service.ejercicio = {};
    service.grupo = 0;
    service.buscar = "";
    service.$uibModalInstance = null;

    service.ok = function (ejercicio) {
        service.$uibModalInstance.close(ejercicio);
    };


    service.cancel = function () {
        service.$uibModalInstance.dismiss('cancel');
    };

    service.playFile = function (musica) {
        playerService.playFile(musica);
    };

    service.isCollapsed = true;
    service.colWidth = "col-md-12";
    service.showGrupos = function () {
        service.isCollapsed = false;
        service.colWidth = "col-md-9";
    };

    service.hideGrupos = function () {
        service.isCollapsed = true;
        service.colWidth = "col-md-12";
    };

    service.filtrarMusica = function (musica, ejercicio) {
        if (service.buscar === '') return true;
        var searchString = service.buscar.toUpperCase();
        if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
        if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;

        if (musica.nombre.toUpperCase().indexOf(searchString) > -1) return true;
        if (musica.interprete.toUpperCase().indexOf(searchString) > -1) return true;
        return false;
    }


    service.mostrarEjercicio = function (ejercicio) {
        service.ejercicio = ejercicio;
        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: 'modalEjercicio.html',
            controller: 'modalEjercicioController',
            size: 'lg',
            resolve: {
                model: function () {
                    return service;
                }
            }
        });
    }
        return service;
    }
]);

services.factory('modelMusicaService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService',
    function($q, $localStorage, $uibModal, NgTableParams, $filter, playerService) {
        var service = {
            ejercicios: db.ejercicios,
            ejercicio: {},
            ejercicioTextFilter: "",
            ejerciciosNombre: [],
            refreshGrid: function() {
                service.tableParams.reload();
            },
            select: false,
            $uibModalInstance: null,
            ok: function(musica) {
                service.$uibModalInstance.close(musica);
            },
            cancel: function() {
                service.$uibModalInstance.dismiss('cancel');
            },
            tableParams: new NgTableParams({ count: 15 },
            {
                total: db.musicas.length,
                getData: function(params) {
                    var orderedData = db.musicas;
                    //if (service.ejercicio.nombre && service.ejercicioTextFilter === "") {
                    //    var ej = $filter('filter')(db.ejercicios, { idEjercicio: service.ejercicio.idEjercicio || service.ejercicio.IdEjercicio });
                    //    orderedData = ej[0].musicas;
                    //}
                    orderedData = params.sorting ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                    orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
                    if (service.ejercicioTextFilter) {
                        var arrEjs = $filter('filter')(db.ejercicios, { nombre: service.ejercicioTextFilter });
                        var arrFiltrado = [];
                        for (var i = 0; i < arrEjs.length; i++) {
                            var eje = arrEjs[i];
                            addMusicasAEjercicio(eje);
                            var filtroMusicas = eje.musicas;
                            var arrEjMusica = $filter('filter')(orderedData,
                                function(value, index, array) {
                                    var fil = $filter('filter')(filtroMusicas,
                                        { coleccion: value.coleccion, nroCd: value.nroCd, nroPista: value.nroPista },
                                        true);
                                    //console.log(value.coleccion + value.nroCd + '-' +value.nroPista + ':' + ret);
                                    if (typeof fil === "undefined") return false;
                                    return fil.length === 1;;
                                });
                            angular.extend(arrFiltrado, arrEjMusica);
                        }
                        orderedData = arrFiltrado;
                    }
                    var musicas = orderedData.slice((params
                            .page() -
                            1) *
                        params.count(),
                        params.page() * params.count());

                    params.total(orderedData.length); // set total for recalc pagination
                    return musicas;
                }
            }),
            playFile: function(musica) {
                playerService.playFile(musica);
            }
        };

        angular.forEach(db.ejercicios,
            function(value) {
                service.ejerciciosNombre.push(value.nombre);
            });
    return service;
}]);
