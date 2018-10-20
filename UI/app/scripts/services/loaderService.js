
services.factory('loaderService', ['loadJsService', '$q', '$localStorage', '$filter', 'alertService', function (loadJsService, $q, $localStorage, $filter, alertService) {
    //var coleccionesPromises = [];
    if (typeof db === 'undefined') { db = {}; }
    db.musicas = [];
    db.colecciones = [];

    function saveColecciones() {
        $localStorage.biosoft_colecciones = db.colecciones;
    }

    if (typeof $localStorage.biosoft_colecciones === "undefined") {
        saveColecciones();
    } else {
        db.colecciones = $localStorage.biosoft_colecciones;
        angular.forEach(db.colecciones, (i) => { i.nombre = i.nombre.toUpperCase() });
    }

    if (typeof $localStorage.biosoft_grupos === "undefined") {
        $localStorage.biosoft_grupos = db.grupos;
    } else {
        db.grupos = $localStorage.biosoft_grupos;
    }

    function addColeccion(col, musicas, save) {
        if (col.nombre.indexOf(" ") > -1) {
            alertService.addDangerAlert("El nombre de la colección no puede tener espacios. " + col);
            return;
        }
        col.nombre = col.nombre.toUpperCase();
        if (db.colecciones.filter((c) => c.nombre === col.nombre).length === 0)  {
            db.colecciones.push(col);
            save = true;
        }
        if (save) {
            saveColeccion(col, musicas);
        }
        var length = db.musicas.length-1;
        for (var i = 0; i <= length; i++) {
            if (db.musicas[length - i].coleccion.toUpperCase() === col.nombre.toUpperCase()) {
                db.musicas.splice(length - i, 1);
            }
        }
        //db.musicas = db.musicas.filter(function (m) { return m.coleccion.toUpperCase() !== col.nombre.toUpperCase() });
        angular.forEach(musicas,
            (musica) => { addMusica(musica) });
    }

    var service = {
        colecciones: function () {
            return promiseEjs;
        }
        , config: function (cfg) {
            if (typeof cfg == 'undefined') {
                var config = $localStorage.biodanzaConfig;
                if (config == null) {
                    config = { pathMusica: 'musica/' }
                }
                return config;
            }
            $localStorage.biodanzaConfig = cfg;
        },
        getEjercicioId : (nombre) => { return toValidJsVariableName(nombre); },
        getEjercicioById: (id) => { return eval("db.ejercicios.x" + id) },
        getEjercicio: function (nombre) {
            var ejercicio;
            try {
                var idEjercicio = service.getEjercicioId(nombre);
                ejercicio = service.getEjercicioById(idEjercicio);
            } catch (e) {
                console.log(e);
            }
            return ejercicio;
        },
        getMusicaById: function (idMusica) {
            var str = "db.musicas." + idMusica;
            return eval(str);
        },
        getMusicaId :(col, cd, pista) => {return "x" + col + "_" + cd + "_" + pista;},
        getMusicaByColCdPista: function (col, cd, pista) {
            var idMusica = service.getMusicaId(col, cd, pista);
            return service.getMusicaById(idMusica);
        },
        infoMusica : function (musicaId) {
            var musica = service.getMusicaById(musicaId);
            if (!musica) return "";
            return musica.coleccion +
                ' ' +
                musica.nroCd +
                '-' +
                musica.nroPista +
                ' ' +
                musica.nombre +
                ' (' +
                musica.interprete +
                ') - ' +
                musica.duracion.substring(3);
        },
        getMusicasEjercicio : (ejercicio) => {
            var musicas = [];
            for (var i = 0; i < ejercicio.musicasId.length; i++) {
                musicas.push(service.getMusicaById(ejercicio.musicasId[i]));
            }
            return musicas;
        }
    };

    var promiseEjs;
    if (typeof $localStorage.biosoft_ejercicios === "undefined") {
        promiseEjs = loadJsService.load("app/data/ejercicios.js");
        promiseEjs.then(() => {
            $localStorage.biosoft_ejercicios = db.ejercicios;
            loadCols();
        });
    } else {
        db.ejercicios = $localStorage.biosoft_ejercicios;
        var q = $q.defer();
        promiseEjs = q.promise;
        q.resolve();
        loadCols();
    }


    function loadCols() {
        angular.forEach(db.ejercicios, (ej) => addEjercicio(ej));
        angular.forEach(db.colecciones,
            function (col) {
                var musicas = eval("$localStorage.biosoft_musica_" + col.nombre);
                //eval("db.musica_" + col.nombre + " = musicas");
                addColeccion(col, musicas);
                //eval('db.musica_' + col.nombre + ' = undefined;');
            });
    }

    function saveColeccion(col, musicas) {
        eval("$localStorage.biosoft_musica_" + col.nombre + "= musicas");
    }

    service.saveEjercicios = () => {
        for (i = 0; i < db.ejercicios.length; i++) {
            for (j = i + 1; j < db.ejercicios.length; j++) {
                if (db.ejercicios[i].nombre === db.ejercicios[j].nombre) {
                    console.log(" ejercicio duplicado: " + db.ejercicios[i].nombre);
                    db.ejercicios.splice(j, 1);
                }
            }
        }
        angular.forEach(db.ejercicios, function (ejercicio) {
            delete ejercicio.musicas;
            delete ejercicio.idEjercicio;
        });
        $localStorage.biosoft_ejercicios = db.ejercicios;
        angular.forEach(db.ejercicios,
            function (ejercicio, index) {
                addEjercicio(ejercicio, index);
            });
    }

    //function setIdMusica(musica) {
    //    if (typeof musica.idMusica !== "undefined" &&  !isNaN(musica.idMusica)) musica.oldId = musica.idMusica;
    //    musica.idMusica = "x" + musica.coleccion + "_" + musica.nroCd + "_" + musica.nroPista;
    //}

    function addMusica(musica) {
        if (!db.musicas.includes(musica)) db.musicas.push(musica);
        musica.coleccion = musica.coleccion.toUpperCase();
        var str = "db.musicas.x" + musica.coleccion + "_" + musica.nroCd + "_" + musica.nroPista + " = musica;";
        eval(str);
        musica.nombreNormalized = musica.nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        musica.interpreteNormalized = musica.interprete.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        musica.cdPista = musica.nroCd + "-" + musica.nroPista;
        delete musica.ejercicios;
        angular.forEach(musica.ejerciciosId, (id) => {
            var ej = service.getEjercicioById(id);
            if (ej) {
                var exists = false;
                for (var i = 0; i < ej.musicas; i++) {
                    if (service.getMusicaById(ej.musicas[i]) === service.getMusicaById(musica)) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) ej.musicas.push(musica);
            }
        });
    }

    function addEjercicio(ejercicio) {
        ejercicio.nombreNormalized = ejercicio.nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        ejercicio.grupoNormalized = ejercicio.grupo.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        var str = "db.ejercicios.x" + service.getEjercicioId(ejercicio.nombre) + " = ejercicio";
        try {
            eval(str);
        } catch (e) {
            console.log(e);
        }
        ejercicio.musicas = [];
        angular.forEach(ejercicio.musicasId,
            function (value, index) {
                try {
                    var musica;
                    musica = service.getMusicaById(value);
                    if (musica) ejercicio.musicas.push(musica);
                } catch (e) {
                    console.log("eval error: " + "db.musicas.x" + value);
                } 
            });
    }


    service.testMusica = function (musica) {
        var deferred = $q.defer();
        var audioElementAng = angular.element(document.querySelector('#audioControl'));
        var audio = audioElementAng[0];
        //audio.volume = 0;
        try {
            audio.src = service.config().pathMusica +
                musica.coleccion +
                '/' +
                musica.carpeta +
                '/' +
                musica.archivo;
        } catch (e) {
            console.log(e);
        } 
        audio.ondurationchange =  function() {
            if (!musica.duracion && audio) musica.duracion = moment(moment(0, 's').add(moment.duration(audio.duration, 's'))).format("HH:mm:ss");
            //audio.pause();
            deferred.resolve(true);            
        };
        audio.onerror = function (e) {
            deferred.reject({ musica: musica, e: e, src: audio.src });
        };
        audio.play().then(function () { }).catch(function(e) {
            deferred.reject({ musica: musica, e: e, src: audio.src });
        });
        return deferred.promise;
    }
    
    service.importarColeccionMusicas = function (coleccion, rows) {
        var col = [];
        angular.forEach(rows, function (row, index) {
            if (row.estado !== "ok") return;
            var arr = $filter('filter')(col, { nroCd: row.nroCd, nroPista: row.nroPista });
            var musica;
            if (arr.length === 1) {
                musica = arr[0];
            } else {
                musica = {};
                musica.archivo = row.Archivo;
                musica.carpeta = row.Carpeta;
                musica.coleccion = coleccion.nombre;
                musica.duracion = row.duracion;
                musica.interprete = row.Interprete;
                musica.lineas = row.Lineas;
                musica.nombre = row.Titulo;
                musica.nroCd = row.nroCd;
                musica.nroPista = row.nroPista;
                musica.ejerciciosId = [];
                setIdMusica(musica);
                col.push(musica);
            }
            if (row.Ejercicio === "") return;
            var ejercicio = service.getEjercicio(row.Ejercicio);
            if (typeof ejercicio === "undefined") {
                ejercicio = {
                    nombre: row.Ejercicio
                    , grupo: row.grupo 
                    , coleccion: coleccion.nombre
                    , detalle: ""
                    , musicas: []
                    , musicasId :[]
                }
                addEjercicio(ejercicio);
            }
            if (ejercicio.musicas.filter((m) => m.idMusica === musica.idMusica ).length === 0) ejercicio.musicas.push(musica);
            if (ejercicio.musicasId.filter((m) => m === musica.idMusica).length === 0) ejercicio.musicasId.push(musica.idMusica);
            var idEjercicio = service.getEjercicioId(ejercicio.nombre);
            if (!musica.ejerciciosId.includes(idEjercicio)) musica.ejerciciosId.push(idEjercicio);
        });
        addColeccion(coleccion, col, true);
        return col;
    }

    service.fileExists = (path) => {
        return loadJsService.load(path);
    }

    service.carpetaColeccion = (colName) => {
        var col = db.colecciones.filter((x) => x.nombre === colName)[0];
        if (!col) {
            alertService.addDangerAlert("la colección: " + colName + " no esta cargada.");
            return undefined;
        }
        return col.carpeta;
    }

    service.addEjercicio = (ejercicio) => {
        addEjercicio(ejercicio);
    }

    return service;
}]);
