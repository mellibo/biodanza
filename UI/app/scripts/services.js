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
        var ej = angular.copy({ nro: clase.ejercicios.length + 1, ejercicio: null, musica: null, consigna: null, cometarios: null, titulo:"" });
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
        selectedEjercicio: "",
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
                // use build-in angular filter
                var orderedData = params.sorting ? $filter('orderBy')(db.musicas, params.orderBy()) : db.musicas;
                orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
                if (context.modelMusicas.selectedEjercicio) {
                    var arrEjs = $filter('filter')(db.ejercicios, { nombre: context.modelMusicas.selectedEjercicio });
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

    return context;
}]);

