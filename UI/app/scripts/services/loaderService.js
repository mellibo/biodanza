
services.factory('loaderService', ['loadJsService', '$q', '$localStorage', '$filter', 'alertService', function (loadJsService, $q, $localStorage, $filter, alertService) {
    var coleccionesPromises = [];
    db.musicas = [];
    db.ejercicios = [];

    function saveColecciones() {
        $localStorage.biosoft_colecciones = db.colecciones;
    }

    if (typeof $localStorage.biosoft_colecciones === "undefined") {
        saveColecciones();
    } else {
        db.colecciones = $localStorage.biosoft_colecciones;
    }

    function addEjercicio(ejercicio) {
        var index = db.ejercicios.indexOf(ejercicio);
        if (index === -1) {
            db.ejercicios.push(ejercicio);
            index = db.ejercicios.length - 1;
        }
        delete ejercicio.idEjercicio;
        var i, j;
        if (ejercicio.musicasId) {
            if (ejercicio.musicasId !== null) {
                for (i = 0; i < ejercicio.musicasId.length; i++) {
                    for (j = i + 1; j < ejercicio.musicasId.length; j++) {
                        if (ejercicio.musicasId[i] === ejercicio.musicasId[j])
                            ejercicio.musicasId.splice(j, 1);
                    }
                }
            }
        }
        var str = "db.ejercicios.x" + toValidJsVariableName(ejercicio.nombre) + " = db.ejercicios[ " + index + "];";
        try {
            eval(str);
        } catch (e) {
            console.log(e);
        }
        ejercicio.musicas = [];
        angular.forEach(ejercicio.musicasId,
            function (value, index) {
                try {
//                    var string = "db.musicas." + (value.charAt(0) === "x" ? "" :"x") + value;
                    var musica;
                    if (isNaN(value)) {
                        musica = service.getMusicaById(value);
                    } else {
                        var arr = db.musicas.filter((m) => { return m.oldId === value });
                        if (arr.length > 0) {
                            musica = arr[0];
                            ejercicio.musicasId[index] = musica.idMusica;
                        }
                    }
                    if (musica) ejercicio.musicas.push(musica);
                } catch (e) {
                    console.log("eval error: " + "db.musicas.x" + value);
                } 
            });

    }

    function addColeccion(col, musicas, save) {
        if (col.nombre.indexOf(" ") > -1) {
            alertService.addDangerAlert("El nombre de la colección no puede tener espacios. " + col);
            return;
        }
        if (db.colecciones.filter((c) => c.nombre === col.nombre).length === 0)  {
            db.colecciones.push(col);
            save = true;
        }
        if (save) {
            saveColeccion(col, musicas);
        }
        db.musicas = db.musicas.filter(function (m) { return m.coleccion !== col.nombre });
        //angular.extend(db.musicas, col);
        Array.prototype.push.apply(db.musicas, musicas);        
    }

    function loadCols() {
        angular.forEach(db.colecciones,
            function (col) {
                var musicas = eval("$localStorage.biosoft_musica_" + col.nombre);
                if (typeof musicas === "undefined") {
                    var promise = loadJsService.load("app/data/musica_" + col.nombre + '.js');
                    coleccionesPromises.push(promise);
                } else {
                    eval("db.musica_" + col.nombre + " = musicas");
                }
            });
        //si cargo todas desde localstorage genero un promise ficticio en coleccionesPromises
        if (coleccionesPromises.length === 0) {
            var deferred = $q.defer();
            coleccionesPromises.push(deferred.promise);
            deferred.resolve();
        }
    }

    function saveColeccion(col, musicas) {
        eval("$localStorage.biosoft_musica_" + col.nombre + "= musicas");
    }

    function loadAll() {
        console.log("loadAll");
        $q.all(coleccionesPromises).then(function () {
            angular.forEach(db.colecciones,
                (col) => {
                    var musicas = eval('db.musica_' + col.nombre);
                    
                    addColeccion(col, musicas);
                    eval('db.musica_' + col.nombre + ' = undefined;');
                    if (!eval("$localStorage.biosoft_musica_" + col.nombre)) saveColeccion(col, musicas);
                });
            angular.forEach(db.musicas, addMusica);
            if (typeof $localStorage.biosoft_ejercicios === "undefined") {
                angular.forEach(db.ejercicios, (ej) => addEjercicio(ej));
                service.saveEjercicios();
            } else {
                db.ejercicios = $localStorage.biosoft_ejercicios;
                angular.forEach(db.ejercicios, (ej) => addEjercicio(ej));
            }

            if (typeof $localStorage.biosoft_grupos === "undefined") {
                $localStorage.biosoft_grupos = db.grupos;
            } else {
                db.grupos = $localStorage.biosoft_grupos;
            }
        });
    }

    loadCols();
    var promise = $q.all(coleccionesPromises);
    promise.then(function () {
        loadAll();
    });

    var service = {
        colecciones: function () {
            if (coleccionesPromises.length > 0) {
                return $q.all(coleccionesPromises);
            }
            
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
            var ejercicio;
            try {
                ejercicio = eval("db.ejercicios.x" + toValidJsVariableName(nombre));
            } catch (e) {
                console.log(e);
            }
            return ejercicio;
        },
        getMusicaById: function (idMusica) {
            var str = "db.musicas." + idMusica;
            return eval(str);
        },
        getMusicaByColCdPista: function (col, cd, pista) {
            var idMusica = "x" + col + "_" + cd + "_" + pista;
            return service.getMusicaById(idMusica);
        }
    };

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

    function setIdMusica(musica) {
        if (typeof musica.idMusica !== "undefined" &&  !isNaN(musica.idMusica)) musica.oldId = musica.idMusica;
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
            if (row.estado !==  "ok") return;
            var musica = service.getMusicaByColCdPista(coleccion.nombre, row.nroCd, row.nroPista);
            if (!musica) {
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
                setIdMusica(musica);
            }

            var ejercicio = service.getEjercicio(row.Ejercicio);
            if (typeof ejercicio === "undefined") {
                ejercicio = {
                    nombre: row.Ejercicio
                    , grupo: row.grupo 
                    , idGrupo: row.idGrupo 
                    , coleccion: coleccion.nombre
                    , detalle: ""
                    , musicas: []
                    , musicasId :[]
                }
                addEjercicio(ejercicio);
            }
            col.push(musica);
            if (ejercicio.musicas.filter((m) => m.idMusica === musica.idMusica ).length === 0) ejercicio.musicas.push(musica);
            if (ejercicio.musicasId.filter((m) => m === musica.idMusica).length === 0) ejercicio.musicasId.push(musica.idMusica);
        });
        addColeccion(coleccion, col, true);
        return col;
    }

    service.fileExists = (path) => {
        return loadJsService.load(path);
    }

    service.carpetaColeccion = (col) => { return db.colecciones.filter((x) => x.nombre === col)[0].carpeta }

    service.addEjercicio = (ejercicio) => {
        addEjercicio(ejercicio);
    }

    return service;
}]);
