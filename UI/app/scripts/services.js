var services = angular.module('services', []);

services.factory('contextService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', function ($q, $localStorage, $uibModal, NgTableParams, $filter) {
    var context = {};

    context.config = function(cfg) {
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

    //context.clases();

    //var _clase = null;
    //context.clase = function(value) {
    //    if (typeof value == 'undefined') {
    //        var value = _clase;
    //        if (value === null) return null;
    //        if (value == null) {
    //            value = context.nuevaClase();
    //        }
    //        return value;
    //    }
    //    _clase = value;
    //};

    context.playFn = null;
    context.play = function(musica) {
        this.playFn(musica);
    };

    context.modelEjercicios = {
        refreshGrid: function () {
            context.modelEjercicios.tableParams.reload();
        },
        tableParams: new NgTableParams({ count: 15 },
        {
            total: db.ejercicios.length,
            getData: function (params) {
                // use build-in angular filter
                var orderedData = params.sorting ? $filter('orderBy')(db.ejercicios, params.orderBy()) : db.ejercicios;
                orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
                if (context.modelEjercicios.buscar !== "" || context.modelEjercicios.grupo !== 0) {
                    orderedData = $filter('filter')(orderedData,
                        function(ejercicio, index, array) {
                            if (context.modelEjercicios.grupo !== 0 &&
                                context.modelEjercicios.grupo !== ejercicio.idGrupo) return false;
                            if (context.modelEjercicios.buscar === '') return true;
                            var searchString = context.modelEjercicios.buscar.toUpperCase();
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
    context.modelEjercicios.select = false;
    context.modelEjercicios.grupos = db.grupos;
    //context.modelEjercicios.ejercicios = db.ejercicios;
    context.musicaSeleccionada = {};
    context.modelEjercicios.ejercicio = {};
    context.modelEjercicios.grupo = 0;
    context.modelEjercicios.buscar = "";
    context.modelEjercicios.$uibModalInstance = null;

    context.modelEjercicios.ok = function (ejercicio) {
        context.modelEjercicios.$uibModalInstance.close(ejercicio);
    };


    context.modelEjercicios.cancel = function () {
        context.modelEjercicios.$uibModalInstance.dismiss('cancel');
    };

    context.modelEjercicios.playFile = function (musica) {
        context.play(musica);
    };

    context.modelEjercicios.isCollapsed = true;
    context.modelEjercicios.colWidth = "col-md-12";
    context.modelEjercicios.showGrupos = function () {
        context.modelEjercicios.isCollapsed = false;
        context.modelEjercicios.colWidth = "col-md-9";
    };

    context.modelEjercicios.hideGrupos = function () {
        context.modelEjercicios.isCollapsed = true;
        context.modelEjercicios.colWidth = "col-md-12";
    };

    context.modelEjercicios.filtrarMusica = function (musica, ejercicio) {
        if (context.modelEjercicios.buscar === '') return true;
        var searchString = context.modelEjercicios.buscar.toUpperCase();
        if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
        if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;

        if (musica.nombre.toUpperCase().indexOf(searchString) > -1) return true;
        if (musica.interprete.toUpperCase().indexOf(searchString) > -1) return true;
        return false;
    }


    context.modelEjercicios.mostrarEjercicio = function (ejercicio) {
        context.modelEjercicios.ejercicio = ejercicio;
        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: 'modalEjercicio.html',
            controller: 'modalEjercicioController',
            size: 'lg',
            resolve: {
                model: function () {
                    return context.modelEjercicios;
                }
            }
        });
    }

    context.modelMusicas = {
        ejercicios: db.ejercicios,
        ejercicio: {},
        ejercicioTextFilter: "",
        ejerciciosNombre: [],
        refreshGrid: function () {
            context.modelMusicas.tableParams.reload();
        },
        select: false,
        $uibModalInstance : null,
        ok : function (musica) {
            context.modelMusicas.$uibModalInstance.close(musica);
        },
        cancel : function () {
            context.modelMusicas.$uibModalInstance.dismiss('cancel');
        },
        tableParams: new NgTableParams({ count: 15 },
        {
            total: db.musicas.length,
            getData: function (params) {
                var orderedData = db.musicas;
                if (context.modelMusicas.ejercicio.nombre && context.modelMusicas.ejercicioTextFilter ==="") {
                    var ej = $filter('filter')(db.ejercicios, { idEjercicio: context.modelMusicas.ejercicio.idEjercicio || context.modelMusicas.ejercicio.IdEjercicio });
                    orderedData = ej[0].musicas;
                }
                orderedData = params.sorting ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
                if (context.modelMusicas.ejercicioTextFilter) {
                    var arrEjs = $filter('filter')(db.ejercicios, { nombre: context.modelMusicas.ejercicioTextFilter });
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
            context.play(musica);
        }
    };
    angular.forEach(db.ejercicios, function (value) {
        context.modelMusicas.ejerciciosNombre.push(value.nombre);
    });

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
    'contextService', '$document',
    function(contextService, $document) {

        var audioElementAng = angular.element(document.querySelector('#audioControl'));
        var audio = audioElementAng[0];

        var service = {
            play: function () {
                audio.play();
            },
            stop: function () {
            },
            pause: function () {
                audio.pause();
            }
        };


        service.controllerModel = {
            state: "",
            play: function() {
                service.play();
            },
            stop: function() {
                service.stop();
            },
            pause: function() {
                service.pause();
            },
            musicaSeleccionada: {},
            musicaFile: "",
            playList : []
        };

        service.stop = function() {
            service.pause();
            audio.currentTime = 0;
        };
        service.playFile = function (musica) {
            if (musica === null) return;
            service.controllerModel.musicaSeleccionada = musica;
            service.controllerModel.musicaFile = contextService.config().pathMusica + musica.coleccion + '/' + musica.carpeta + '/' + musica.archivo;
        }

        audioElementAng.bind('play',
            function () {
                service.controllerModel.state = "playing";
            });
        audioElementAng.bind('playing',
            function () {
                service.controllerModel.state = "playing";
            });
        audioElementAng.bind('pause',
            function () {
                service.controllerModel.state = "pause";
            });
        audioElementAng.bind('ended',
            function () {
                service.controllerModel.state = "ended";
            });
        audioElementAng.bind('error',
            function ($event) {
                service.controllerModel.state = "error";
                console.log($event);
            });

        contextService.playFn = service.playFile;


        return service;
    }
]);