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
            service.grupo = 0;
            service.buscar = "";
        },
        isMobileOrTablet: contextService.isMobileOrTablet(),
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
        service.reset();
        service.$uibModalInstance.close(ejercicio);
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
    function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService) {
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
            cleanSearch: () => { service.tableParams.page(1) },
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
                    //if (service.ejercicio.nombre && service.ejercicioTextFilter === "") {
                    //    var ej = $filter('filter')(db.ejercicios, { idEjercicio: service.ejercicio.idEjercicio || service.ejercicio.IdEjercicio });
                    //    orderedData = ej[0].musicas;
                    //}
                    if (service.ejercicioTextFilter) {
                        var arrEjs = $filter('filter')(db.ejercicios, { nombre: service.ejercicioTextFilter });
                        var arrFiltrado = [];
                        for (var i = 0; i < arrEjs.length; i++) {
                            var eje = arrEjs[i];
                            var filtroMusicas = eje.musicas;
                            var arrEjMusica = $filter('filter')(eje.musicas,
                                function (value, index, array) {
                                    if (!arrFiltrado.includes(value)) arrFiltrado.push(value);
                                    //var fil = $filter('filter')(filtroMusicas,
                                    //    { coleccion: value.coleccion, nroCd: value.nroCd, nroPista: value.nroPista },
                                    //    true);
                                    ////console.log(value.coleccion + value.nroCd + '-' +value.nroPista + ':' + ret);
                                    //if (typeof fil === "undefined") return false;
                                    //return fil.length === 1;;
                                });
                            //angular.extend(arrFiltrado, arrEjMusica);
                        }
                        orderedData = arrFiltrado;
                    }
                    orderedData = params.sorting ? $filter('orderBy')(orderedData, params.orderBy()) : orderedData;
                    orderedData = params.filter ? $filter('filter')(orderedData, params.filter()) : orderedData;
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

