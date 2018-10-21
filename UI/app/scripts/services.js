var services = angular.module('services', []);

//function addMusicasAEjercicio(ejercicio) {
//    if (typeof ejercicio.musicas !== "undefined") return;
//    ejercicio.musicas = [];
//    angular.forEach(ejercicio.musicasId,
//        function (value) {
//            var musica;
//            if (typeof value === "number") { // para cuando idMusica es numerico
//                angular.forEach(db.musicas, function(item) {
//                    if (item.oldId === value) {
//                        musica = item;
//                        ejercicio.musicas.push(musica);
//                        return;
//                    }
//                });
//            } else {
//                musica = eval("db.musicas." + value);
//                if (musica) ejercicio.musicas.push(musica);
//            }
//        });
//}

services.factory('contextService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', '$location', '$rootScope', 'loaderService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, $location, $rootScope, loaderService) {
    var context = {};

    context.isMobileOrTablet = function () { return ismobile || istablet };


    //context.exportMiMusica = function() {
    //    var code = "if (typeof db === 'undefined') { db = {}; }\n\ndb.miMusica = [";

    //    var coma = "";
    //    angular.forEach(db.miMusica, function (item) {
    //        if (item.idMusica === 0 || typeof item.idMusica === "undefined") setIdMusica(item);
    //        code += coma +
    //            "{ idMusica : " + item.idMusica + ", coleccion : '" + item.coleccion + "', nroCd : " + item.nroCd + ", nroPista : " + item.nroPista + ", nombre: '" + item.nombre + "', interprete : '" + item.interprete + "', duracion : '" + item.duracion + "', archivo : '" + item.archivo + "', carpeta : '" + item.carpeta + "', lineas : '" + item.lineas + "' }";
    //    });
    //    code += "];";
    //    downloadString(code, "mimusica.js");
    //}


    //context.importarMusicas = function (file, cb) {
    //    var result = [];
    //    var reader = new FileReader();
    //    reader.onloadend = function (evt) {
    //        console.log("reader.onloadend");
    //        if (evt.target.readyState === FileReader.DONE) {
    //            var json="";
    //            try {
    //                json = eval(evt.target.result);
    //            } catch (e) {
    //            }
    //            if (!Array.isArray(json)) {
    //                result.push({ msg: "el archivo de importación es incorrecto." });
    //                cb(result);
    //                return;
    //            }
    //            var audio = new Audio();
    //            audio.musicas = json;
    //            audio.onerror = function (error) {
    //                result.push({
    //                    titulo: audio.musica.nombre,
    //                    coleccion: audio.musica.coleccion,
    //                    archivo: audio.musica.archivo,
    //                    ok: false,
    //                    msg: "error al cargar archivo: " + loaderService.config().pathMusica +
    //                            audio.musica.coleccion +
    //                            '/' +
    //                            audio.musica.carpeta +
    //                            '/' +
    //                            audio.musica.archivo
    //            });
    //                console.log("error en archivo " + audio.musica.archivo);
    //                if (audio.musicas.length === 0) {
    //                    cb(result);
    //                    return;
    //                }
    //                testMusica(audio);
    //            }
    //            audio.onplaying = function () {
    //                var search = $filter('filter')(db.musicas,
    //                    {
    //                        nroCd: audio.musica.nroCd,
    //                        nroPista: audio.musica.nroPista,
    //                        coleccion: audio.musica.coleccion
    //                    },
    //                    true);
    //                result.push({
    //                    titulo: audio.musica.nombre,
    //                    coleccion: audio.musica.coleccion,
    //                    archivo: audio.musica.archivo,
    //                    ok: search.length === 0,
    //                    msg: search.length === 0 ? "importado correctamente" : "ya existe el título en la colección"
    //            });
    //                if (search.length === 0) {
    //                    maxIdMusica++;
    //                    audio.musica.idMusica = maxIdMusica;
    //                    musicasPersonales.push(audio.musica);
    //                    $localStorage.musicas = musicasPersonales;
    //                    addMusica(audio.musica);
    //                }
    //                testMusica(audio);
    //            }
    //            if (audio.musicas.length === 0) {
    //                cb(result);
    //                return;
    //            }
    //            testMusica(audio);
    //        }
    //    };
    //    reader.readAsText(file);
    //};

    /*
    context.testMusica = function (audio) {
        if (audio.musicas.length === 0) {
            return;
        }
        var item = audio.musicas.pop();
        var musica = context.nuevaMusica();
        musica.coleccion = item.coleccion;
        musica.nroCd = item.nroCd;
        musica.nroPista = item.nroPista,
            musica.nombre = item.titulo || "titulo incorrecto";
        musica.interprete = item.interprete;
        musica.duracion = item.duracion;
        musica.archivo = item.archivo || "archivo incorrecto";
        musica.carpeta = item.carpeta || "carpeta incorrecta";
        musica.lineas = item.lineas;
        audio.musica = musica;
        audio.src = loaderService.config().pathMusica +
            musica.coleccion +
            '/' +
            musica.carpeta +
            '/' +
            musica.archivo;
        audio.play();
    }
    */
    return context;
}]);


services.factory('modelEjerciciosService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', 'contextService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService, contextService) {

    var service = {
        txtBuscarChange: function () {
            service.tableParams.page(1);
            if (ismobile || istablet) return;
                service.refreshGrid();
        },
        refreshGrid: function () {
            service.tableParams.reload();
        },
        reset: function () {
            service.tableParams.page(1);
            service.grupo = 'TODOS';
            service.buscar = "";
        },
        isMobileOrTablet: contextService.isMobileOrTablet(),
        tableParams: new NgTableParams({ count: 15 },
        {
            total: db.ejercicios ? db.ejercicios.length: 0,
            getData: function (params) {
                var orderedData =  db.ejercicios;
                if (service.buscar !== "" || service.grupo !== 'TODOS') {
                    var searchStrings = service.buscar.toUpperCase().split(" ");
                    for (var i = 0; i < searchStrings.length; i++) {
                        searchStrings[i] = searchStrings[i].normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
                    }
                    searchStrings = $filter('filter')(searchStrings, (obj) => { return obj !== "" });
                    orderedData = $filter('filter')(orderedData,
                        function (ejercicio, index, array) {
                            if (service.grupo !== "TODOS" &&
                                service.grupo !== ejercicio.grupo) return false;
                            if (service.buscar === "") return true;
                            var searchString = service.buscar.toUpperCase();
                            for (var i = 0; i < searchStrings.length; i++) {
                                if (ejercicio.nombreNormalized.indexOf(searchStrings[i]) !== -1) return true;
                                if (ejercicio.grupoNormalized.indexOf(searchStrings[i]) !== -1) return true;
                            }
                            var ok = false;
                            angular.forEach(ejercicio.musicas,
                                function (musica) {
                                    if (ok) return;
                                    for (var i = 0; i < searchStrings.length; i++) {
                                        if (musica.nombre.toUpperCase().indexOf(searchStrings[i]) > -1) ok = true;
                                        if (musica.interprete.toUpperCase().indexOf(searchStrings[i]) > -1) ok = true;
                                    }
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
    service.ejercicio = {};
    service.grupo = "TODOS";
    service.buscar = "";
    service.$uibModalInstance = null;

    service.ok = function (ejercicio, musica) {
        service.reset();
        service.$uibModalInstance.close([ejercicio, musica]);
    };


    service.cancel = function () {
        service.reset();
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

        var searchStrings = service.buscar.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(" ");
        for (var i = 0; i < searchStrings.length; i++) {
            if (searchStrings[i] === '') continue;
            if (ejercicio.nombreNormalized.indexOf(searchStrings[i]) !== -1) return true;
            if (ejercicio.grupo.indexOf(searchStrings[i]) !== -1) return true;

            if (musica.nombreNormalized.indexOf(searchStrings[i]) > -1) return true;
            if (musica.interpreteNormalized.indexOf(searchStrings[i]) > -1) return true;

        }
        return false;
    }


    service.mostrarEjercicio = function (ejercicio) {
        service.ejercicio = ejercicio;
        var modalInstance = $uibModal.open({
            animation: true,
            keyboard: false,
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

services.factory('modelMusicaService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', 'loaderService',
function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService, loaderService) {
        var service = {
            ejercicios: db.ejercicios,
            //ejercicio: {},
            ejercicioTextFilter: "",
            ejerciciosNombre: [],
            refreshGrid: function() {
                service.tableParams.reload();
            },
            getEjercicioById: (id) => {
                return loaderService.getEjercicioById(id);
            },
            select: false,
            $uibModalInstance: null,
            cleanSearch: () => {
                service.tableParams.page(1);
                service.tableParams.filter({});
            },
            ok: function (musica) {
                service.cleanSearch();
                service.$uibModalInstance.close(musica);
            },
            cancel: function() {
                service.cleanSearch();
                service.$uibModalInstance.dismiss('cancel');
            },
            tableParams: new NgTableParams({ count: 15 },
            {
                total: db.musicas.length,
                getData: function(params) {
                    var orderedData = db.musicas;
                    if (service.ejercicioTextFilter) {
                        var searchStrings = service.ejercicioTextFilter.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").match(/\w+|"[^"]+"/g);
                        for (var l = 0; l < searchStrings.length; l++) {
                            searchStrings[l] = searchStrings[l].replace(/\"/g, "");
                        }
                        var arrEjs = $filter('filter')(db.ejercicios, (obj) => {
                            for (var k = 0; k < searchStrings.length; k++) {
                                if (obj.nombreNormalized.indexOf(searchStrings[k]) !== -1 || obj.grupo.indexOf(searchStrings[k]) !== -1) {
                                    return true;
                                }
                            }
                            return false;
                        });
                        var arrFiltrado = [];
                        for (var i = 0; i < arrEjs.length; i++) {
                            var eje = arrEjs[i];
                            var filtroMusicas = eje.musicas;
                            var arrEjMusica = $filter('filter')(eje.musicas,
                                function (value, index, array) {
                                    if (!arrFiltrado.includes(value)) arrFiltrado.push(value);
                                });
                            //angular.extend(arrFiltrado, arrEjMusica);
                        }
                        orderedData = arrFiltrado;
                    }
                    orderedData = params.sorting ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                    //orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
                    var filter = params.filter();
                    orderedData = params.filter ? $filter('filter')(orderedData, (obj) => {
                        if (filter.coleccion && filter.coleccion.length > 0) {
                            if (obj.coleccion.indexOf(filter.coleccion.toUpperCase()) === -1) return false;
                        }
                        if (filter.nroCd && filter.nroCd.length > 0) {
                            if (obj.cdPista.indexOf(filter.nroCd.toUpperCase()) === -1) return false;
                        }
                        if (filter.nombre && filter.nombre.length > 0) {
                            var searchStrings = filter.nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(" ");
                            searchStrings = $filter('filter')(searchStrings, (obj) => { return obj !== "" });
                            var match = false;
                            for (var j = 0; j < searchStrings.length; j++) {
                                if (obj.nombreNormalized.indexOf(searchStrings[j]) !== -1 ||
                                    obj.interpreteNormalized.indexOf(searchStrings[j]) !== -1) {
                                    match = true;
                                    break;
                                }
                            }
                            if (!match) return false;
                        }
                        if (filter.lineas && filter.lineas.length > 0) {
                            if (!obj.lineas || obj.lineas.indexOf(filter.lineas.toUpperCase()) === -1) return false;
                        }
                        return true;
                    } ) : orderedData;
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

