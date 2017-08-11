var services = angular.module('services', []);

services.factory('contextService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', function ($q, $localStorage, $uibModal, NgTableParams, $filter) {
    var context = {};

    ////angular.forEach(db.musicas,
    ////    function(value) {
    ////        db.musicas['x' + value.idMusica.toString()] = value;
    ////    });

    context.config = function (cfg) {
        if (typeof cfg == 'undefined') {
            var config = $localStorage.biodanzaConfig;
            if (config == null) {
                config = { pathMusica:''}
            }
            return config;
        }
        $localStorage.biodanzaConfig = cfg;
    };

    context.saveClases = function() {
        $localStorage.biodanzaClases = biodanzaClases;
    }
    context.nuevoEjercicioClase = function(clase) {
        var ej = angular.copy({ nro: clase.ejercicios.length + 1, ejercicio: null, musica: null, consigna: null, cometarios: null, nombre: ""});
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
    'contextService', '$document', '$rootScope', '$interval',
    function (contextService, $document, $rootScope, $interval) {

        var audioElementAng = angular.element(document.querySelector('#audioControl'));
        var audio = audioElementAng[0];

        var service = {
            play: function() {
                audio.play();
            },
            pause: function() {
                audio.pause();
            },
            playList: [],
            playIndex: -1,
            playFromList: function() {
                if (service.playList.length - 1 < service.playIndex) service.playIndex = 0;
                if (service.playList.length - 1 >= service.playIndex) {
                    service.playFile(service.playList[service.playIndex]);
                }
            },
            playNext: function() {
                service.playIndex++;
                service.playFromList();
            },
            playPrevious: function() {
                service.playIndex--;
                service.playFromList();
            },
            duration: 0,
            durationString : function() {
                return (new Date(service.duration * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
            },
            currentTime: 0,
            currentTimeString: function () {
                return (new Date(service.currentTime * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
            },
            state: "",
            errorMessage: "",
            musicaSeleccionada: null,
            musicaFile: "",
            stop: function() {
                service.pause();
                audio.currentTime = 0;
            },
            playFile: function(musica) {
                if (musica === null) return;
                if (service.playIndex !== -1 && service.playList[service.playIndex] !== musica) {
                    service.playIndex = -1;
                    service.playList.splice(0, service.playList.length);
                }
                service.musicaSeleccionada = musica;
                audio.src = contextService.config().pathMusica +
                    musica.coleccion +
                    '/' +
                    musica.carpeta +
                    '/' +
                    musica.archivo;
            },
            playAll: function() {
                if (service.playList.length < 1) return;
                service.playIndex = 0;
                service.playFile(service.playList[0]);
            },
            setCurrentTime: function(value) {
                audio.currentTime = value;
            },
            progressClick: function ($event) {
                if (typeof $event === "undefined") return;
                var progress = angular.element(document.querySelector('#playerProgress'))[0];
                service.setCurrentTime($event.offsetX * service.duration / progress.clientWidth);
            }, changeState: function(newState) {
                service.state = newState;
                switch (newState) {
                    case "playing":
                        service.startStateLoop();
                        break;
                    case "ended", "pause", "error":
                        service.stopStateLoop();
                        break;
                default:
                }
            }, startStateLoop: function () {
                service.stopStateLoop();
                service.intervalState = $interval(service.updateState(), 1000);
            }, stopStateLoop : function() {
                if (typeof service.intervalState !== "undefined") $interval.cancel(service.intervalState);
            }, updateState : function() {
                service.currentTime = audio.currentTime;
                service.duration = audio.duration;
                $rootScope.$apply();
            }
        };
        audioElementAng.bind('play',
            function () {
                service.changeState("playing");
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
                console.log(service.duration);
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
                //$rootScope.$apply();
                console.log($event);
            });

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
                // use build-in angular filter
                var orderedData = params.sorting ? $filter('orderBy')(db.ejercicios, params.orderBy()) : db.ejercicios;
                orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
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
                            angular.forEach(ejercicio.musicas,
                                function (value) {
                                    if (ok) return;
                                    if (value.nombre.toUpperCase().indexOf(searchString) > -1) ok = true;
                                    if (value.interprete.toUpperCase().indexOf(searchString) > -1) ok = true;
                                });
                            return ok;
                        });
                }
                var ejercicios = orderedData.slice((params
                        .page() -
                        1) *
                    params.count(),
                    params.page() * params.count());

                params.total(orderedData.length);
                return ejercicios;
            }
        })
    };
    service.select = false;
    service.grupos = db.grupos;
    //service.ejercicios = db.ejercicios;
    service.musicaSeleccionada = {};
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

services.factory('modelMusicaService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService) {
    var service  = {
        ejercicios: db.ejercicios,
        ejercicio: {},
        ejercicioTextFilter: "",
        ejerciciosNombre: [],
        refreshGrid: function () {
            service.tableParams.reload();
        },
        select: false,
        $uibModalInstance: null,
        ok: function (musica) {
            service.$uibModalInstance.close(musica);
        },
        cancel: function () {
            service.$uibModalInstance.dismiss('cancel');
        },
        tableParams: new NgTableParams({ count: 15 },
        {
            total: db.musicas.length,
            getData: function (params) {
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
                        var filtroMusicas = eje.musicas;
                        var arrEjMusica = $filter('filter')(orderedData,
                            function (value, index, array) {
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
        musicaSeleccionada: {},
        playFile: function (musica) {
            playerService.playFile(musica);
        }
    };
    angular.forEach(db.ejercicios, function (value) {
        service.ejerciciosNombre.push(value.nombre);
    });

    return service;
}]);
