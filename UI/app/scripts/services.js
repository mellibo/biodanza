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

services.factory('contextService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', '$location', '$rootScope', function ($q, $localStorage, $uibModal, NgTableParams, $filter, $location, $rootScope) {
    var context = {};

    var biodanzaClases = null;

    context.isMobileOrTablet = function () { return ismobile || istablet };

    var downloadString = function (string, filename) {
        var data = string;
        var blob = new Blob([data], { type: 'text/js' }),
            e = document.createEvent('MouseEvents'),
            a = document.createElement('a');

        a.download = filename;
        a.href = window.URL.createObjectURL(blob);
        a.dataset.downloadurl = ['text/js', a.download, a.href].join(':');
        e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(e);
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

    var maxIdMusica = 1000000;
    function setIdMusica(musica) {
        maxIdMusica++;
        musica.idMusica = maxIdMusica;
    }

    function addMusica(musica, index) {
        if (typeof index === 'undefined') {
            db.musicas.push(musica);
            index = db.musicas.length - 1;
        }
        var str = "db.musicas.x" + musica.idMusica + " = db.musicas[ " + index + "];";
        eval(str);
        if (musica.idMusica === 0 || typeof musica.idMusica === "undefined") setIdMusica(musica);
        if (maxIdMusica < musica.idMusica) maxIdMusica = musica.idMusica;
    }

    context.exportMiMusica = function() {
        var code = "if (typeof db === 'undefined') { db = {}; }\n\ndb.miMusica = [";

        var coma = "";
        angular.forEach(db.miMusica, function (item) {
            if (item.idMusica === 0 || typeof item.idMusica === "undefined") setIdMusica(item);
            code += coma +
                "{ idMusica : " + item.idMusica + ", coleccion : '" + item.coleccion + "', nroCd : " + item.nroCd + ", nroPista : " + item.nroPista + ", nombre: '" + item.nombre + "', interprete : '" + item.interprete + "', duracion : '" + item.duracion + "', archivo : '" + item.archivo + "', carpeta : '" + item.carpeta + "', lineas : '" + item.lineas + "' }";
        });
        code += "];";
        downloadString(code, "mimusica.js");
    }

    angular.forEach(db.miMusica, function (item) { db.musicas.push(item) });
    angular.forEach(db.musicas, addMusica);

    context.importarMusicas = function (file, cb) {
        var result = [];
        var reader = new FileReader();
        reader.onloadend = function (evt) {
            console.log("reader.onloadend");
            if (evt.target.readyState === FileReader.DONE) {
                var json="";
                try {
                    json = eval(evt.target.result);
                } catch (e) {
                }
                if (!Array.isArray(json)) {
                    result.push({ msg: "el archivo de importación es incorrecto." });
                    cb(result);
                    return;
                }
                var audio = new Audio();
                audio.musicas = json;
                audio.onerror = function (error) {
                    result.push({
                        titulo: audio.musica.nombre,
                        coleccion: audio.musica.coleccion,
                        archivo: audio.musica.archivo,
                        ok: false,
                        msg: "error al cargar archivo: " + context.config().pathMusica +
                                audio.musica.coleccion +
                                '/' +
                                audio.musica.carpeta +
                                '/' +
                                audio.musica.archivo
                });
                    console.log("error en archivo " + audio.musica.archivo);
                    if (audio.musicas.length === 0) {
                        cb(result);
                        return;
                    }
                    testMusica(audio);
                }
                audio.onplaying = function () {
                    var search = $filter('filter')(db.musicas,
                        {
                            nroCd: audio.musica.nroCd,
                            nroPista: audio.musica.nroPista,
                            coleccion: audio.musica.coleccion
                        },
                        true);
                    result.push({
                        titulo: audio.musica.nombre,
                        coleccion: audio.musica.coleccion,
                        archivo: audio.musica.archivo,
                        ok: search.length === 0,
                        msg: search.length === 0 ? "importado correctamente" : "ya existe el título en la colección"
                });
                    if (search.length === 0) {
                        maxIdMusica++;
                        audio.musica.idMusica = maxIdMusica;
                        musicasPersonales.push(audio.musica);
                        $localStorage.musicas = musicasPersonales;
                        addMusica(audio.musica);
                    }
                    testMusica(audio);
                }
                if (audio.musicas.length === 0) {
                    cb(result);
                    return;
                }
                testMusica(audio);
            }
        };
        reader.readAsText(file);
    };


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
        audio.src = context.config().pathMusica +
            musica.coleccion +
            '/' +
            musica.carpeta +
            '/' +
            musica.archivo;
        audio.play();
    }

    angular.forEach(db.ejercicios,
        function(ejercicio, index) {
            var str = "db.ejercicios.x" + ejercicio.idEjercicio + " = db.ejercicios[ " + index + "];";
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
        if (ejercicio.pauseEmpalme > 0) tiempo.add(ejercicio.pauseEmpalme, 's');
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

    context.nuevoEjercicioClase = function(clase) {
        var ej = nuevoEjercicio(clase.ejercicios.length + 1);
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

    context.nuevaMusica = function() {
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

    context.insertarEjercicio = function (clase, ejercicio) {
        var nro = ejercicio.nro;
        clase.ejercicios.splice(nro -1, 0, nuevoEjercicio(nro));
        for (var i = nro-1; i < clase.ejercicios.length; i++) {
            clase.ejercicios[i].nro = i + 1;
        }
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
            biodanzaClases = [claseEjemplo];
        }
            
        return biodanzaClases;
    };
    context.clases();

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
                            var musica = eval("db.musicas.x" + ej.musica.idMusica);
                            if (typeof musica === "undefined" || musica.coleccion !== ej.musica.coleccion || musica.nroCd !== ej.musica.nroCd || musica.nroPista !== ej.musica.nroPista) {
                                var musicas = $filter('filter')(db.musicas, { coleccion: ej.musica.coleccion, nroCd: ej.musica.nroCd, nroPista: ej.musica.nroPista }, true);
                                if (musicas.length === 1) musica = musicas[0];
                            }
                            if (!musica) {
                                console.log("musica no encontrada:" + ej.musica.nombre);
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
        context.saveClases();
    }
    loadClases();

    context.importarClases = function (file) {
        var reader = new FileReader();
        reader.onloadend = function(evt) {
            if (evt.target.readyState === FileReader.DONE) {
                console.log(evt.target.result);
                var json = eval(evt.target.result.substring(evt.target.result.indexOf('[')));
                angular.forEach(json,
                    function(item) {
                        biodanzaClases.unshift(item);
                    });
                loadClases();
            }
        };
        reader.readAsText(file);
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
                    iniciarSegundos : value.iniciarSegundos,
                    finalizarSegundos : value.finalizarSegundos,
                    segundosInicioProgresivo : value.segundosInicioProgresivo,
                    segundosFinProgresivo : value.segundosFinProgresivo,
                    pauseEmpalme: value.pauseEmpalme,
                    volumen: value.volumen,
                    minutosAdicionales : value.minutosAdicionales,
                    cantidadRepeticiones : value.cantidadRepeticiones,
                    deshabilitado : value.deshabilitado,
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

    context.exportarClases = function() {
        var clases = [];
        angular.forEach(context.clases(), function(value) {
            var clase = buildExpClase(value);
            clases.push(clase);
        });
        downloadJson(clases, "clases biodanza.bio");
    };


    context.exportarClase = function (clase) {
        var clases = [];
        var claseExp = buildExpClase(clase);
        clases.push(clase);

        downloadJson(clases, claseExp.titulo + ".bio");
    };

    return context;
}]);

services.factory('playerService',
[
    'contextService', '$document', '$rootScope', '$interval', '$filter', '$timeout',
function (contextService, $document, $rootScope, $interval, $filter, $timeout) {

        var audioElementAng = angular.element(document.querySelector('#audioControl'));
        var audio = audioElementAng[0];

        var timeoutEmpalme = null;
        var timeoutFinProgresivo = null;
        var service = {
            play: function() {
                if (audio.currentTime === 0 && service.clase &&
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
                if (service.clase && service.clase.ejercicios.length - 1 >= service.playIndex) {
                    audio.repeatCount = undefined;
                    service.playFile(service.clase.ejercicios[service.playIndex].musica,
                        service.clase.ejercicios[service.playIndex]);
                }
            },
            playNext: function () {
                var index = service.playIndex;
                do {
                    if (service.clase && service.playIndex === service.clase.ejercicios.length - 1) {
                        service.playIndex = index;
                        return;
                    }
                    service.playIndex++;
                } while (service.clase.ejercicios[service.playIndex].deshabilitado);

                service.playFromList();
            },
            playPrevious: function() {
                var index = service.playIndex;
                do {
                    if (service.clase && service.playIndex === 0) {
                        service.playIndex = index;
                        return;
                    }
                    service.playIndex--;
                } while (service.clase.ejercicios[service.playIndex].deshabilitado);
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
            playFile: function (musica, ejercicio) {
                if (timeoutEmpalme) {
                    console.log("cancel timeoutEmpalme ");
                    $timeout.cancel(timeoutEmpalme);
                    timeoutEmpalme = null;
                }
                if (audio.timerInicio) {
                    console.log("cancel audio.timerInicio ");
                    $timeout.cancel(audio.timerInicio);
                    audio.timerInicio = undefined;
                }
                if (timeoutFinProgresivo) {
                    console.log("cancel timeoutFinProgresivo");
                    $timeout.cancel(timeoutFinProgresivo);
                    timeoutFinProgresivo = null;
                }
                if (audio.intervalFinProgresivo) {
                    console.log("cancel audio.intervalFinProgresivo ");
                    $interval.cancel(audio.intervalFinProgresivo);
                    audio.intervalFinProgresivo = undefined;
                }
                if (audio.intervalInicioVolume) {
                    console.log("cancel timeoutEmpalme ");
                    $interval.cancel(audio.intervalInicioVolume);
                    audio.intervalInicioVolume = undefined;
                }
                audio.volume = ejercicio ? ejercicio.volumen / 100 : 1;
                audio.ejercicio = ejercicio;
                if (!ejercicio) service.playContinuo = false;
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
                    audio.volumeStep = ejercicio.volumen / 100 / (ejercicio.segundosInicioProgresivo * 1000 / 200);
                    console.log("start audio.intervalInicioVolume " + ejercicio.segundosInicioProgresivo);
                    audio.intervalInicioVolume = $interval(function() {
                        if (audio.volume + audio.volumeStep >= ejercicio.volumen /100) {
                                $interval.cancel(audio.intervalInicioVolume);
                                console.log("cancel audio.intervalInicioVolume ");
                                audio.intervalInicioVolume = undefined;
                                audio.volume = ejercicio.volumen/ 100;
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
                //if (ejercicio) {
                //    service.message += ejercicio.nombre;
                //    if (ejercicio.ejercicio) service.message += ' (' + ejercicio.ejercicio.nombre + ').';
                //}
                try {
                    audio.play();
                } catch (e) {
                    service.error = e.message;
                }
            },
            playAll: function() {
                if (service.clase.ejercicios.length < 1) return;
                service.playIndex = 0;
                service.playContinuo = true;
                service.playNext();
            },
            setCurrentTime: function(value) {
                audio.currentTime = value;
            },
            progressClick: function($event) {
                if (typeof $event === "undefined") return;
                var progress = angular.element(document.querySelector('#playerProgress'))[0];
                service.setCurrentTime($event.offsetX * service.duration / progress.clientWidth);
            },
            playContinuo : false,
            changeState: function(newState) {
                console.log(newState);
                switch (newState) {
                case "playing":
                    //service.startStateLoop();
                    break;
                    case "ended":
                        if (audio.timerInicio) return;
                    if (!audio.ended) {
                        service.stop();
                    }
                    console.log("cancel timeoutFinProgresivo");
                    if (timeoutFinProgresivo) $timeout.cancel(timeoutFinProgresivo);
                    if (service.clase) {
                        service.tiempoRestanteClase();
                        if (service.playIndex > -1 &&
                            service.clase.ejercicios[service.playIndex].cantidadRepeticiones >
                            audio.repeatCount) {
                            audio.repeatCount++;
                            console.log("start audio.timerInicio " + 30);
                            audio.timerInicio = $timeout(function() {
                                console.log("elapsed audio.timerInicio ");
                                service.playFile(service.clase.ejercicios[service.playIndex].musica,
                                        service.clase.ejercicios[service.playIndex]);
                                },
                                30 * 1000);
                            return;
                        }
                    }
                    if (service
                        .playIndex >
                        -1 &&
                        service.clase.ejercicios[service.playIndex].pauseEmpalme > 0)
                    {
                        console.log("start timeoutEmpalme " + service.clase.ejercicios[service.playIndex].pauseEmpalme);
                        if (!timeoutEmpalme) timeoutEmpalme = $timeout(function () {
                            console.log("elapsed timeoutEmpalme " + service.clase.ejercicios[service.playIndex].pauseEmpalme);
                            timeoutEmpalme = null;
                            service.playNext();
                            },
                            service.clase.ejercicios[service.playIndex].pauseEmpalme * 1000);
                        service.segundosParaEmpalme = service.clase.ejercicios[service.playIndex].pauseEmpalme;
                    }
                case "pause":
                case "error":
                    service.stopStateLoop();
                    break;
                default:
                }
                service.state = newState;
            },
            startStateLoop: function() {
                //service.stopStateLoop();
                if (!service.intervalState) service.intervalState  = $interval(service.updateState, 1000);
            },
            stopStateLoop: function() {
                //if (service.intervalState) $interval.cancel(service.intervalState);
            },
            updateState: function() {
                service.currentTime = audio.currentTime;
                service.duration = audio.duration || 0;
                if (timeoutEmpalme) service.segundosParaEmpalme--;
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
            if (timeoutEmpalme) return;
            console.log("start activarFinProgresivo " + segundosFinProgresivo);
            audio.volumeStepFin = 1 / (segundosFinProgresivo * 1000 / 200);
            audio.intervalFinProgresivo = $interval(function() {
                    if (audio.volume - audio.volumeStepFin >= 0) audio.volume -= audio.volumeStepFin;
                },
                200);
            timeoutFinProgresivo=  $timeout(function() {
                console.log("elapsed-cancel activarFinProgresivo ");
                $interval.cancel(audio.intervalFinProgresivo);
                    audio.intervalFinProgresivo = undefined;
                    service.changeState('ended');
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
                if (service.playContinuo) service.playNext();
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

services.factory('modelEjerciciosService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', 'contextService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService, contextService) {

    var service = {
        txtBuscarChange: function () {
            if (ismobile || istablet) return;
                service.refreshGrid();
        },
        refreshGrid: function () {
            service.tableParams.reload();
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


services.factory('testMusicaService',
[
    '$q', '$filter', 'contextService', function ($q, $filter, contextService) {

        var service = {
            test : function(musica, cb) {
                var audio = new Audio();
                audio.onerror = function (error) {
                    cb({
                        ok: false,
                        msg: "error al cargar archivo: " + contextService.config().pathMusica +
                                musica.coleccion +
                                '/' +
                                musica.carpeta +
                                '/' +
                                musica.archivo
                    });
                    console.log("error en archivo " + musica.archivo);
                }
                audio.onplaying = function () {
                    musica.duracion = moment(moment(0, 's').add(moment.duration(audio.duration, 's')))
                        .format("HH:mm:ss");
                    audio.pause();
                    var search = $filter('filter')(db.musicas,
                        {
                            nroCd: musica.nroCd,
                            nroPista: musica.nroPista,
                            coleccion: musica.coleccion
                        },
                        true);
                    if (search.length === 0) search = $filter('filter')(db.musicas,
                        {
                            carpeta: musica.carpeta,
                            archivo: musica.archivo,
                            coleccion: musica.coleccion
                        },
                        true);
                    audio = null;
                    cb({
                        ok: search.length === 0,
                        msg: search.length === 0 ? "música validada correctamente. Presione Agregar para incorporarla a las músicas del sistema" : "ya existe el título en la colección"
                    });
                }
                audio.src = contextService.config().pathMusica + musica.coleccion + "/" + musica.carpeta + "/" + musica.archivo;
                audio.play();
            }
        }

        return service;
    }
]);

        var claseEjemplo = {
    "titulo": "Clase de prueba",
    "fechaCreacion": "2017-08-01T00:44:49.801Z",
    "fechaClase": "2017-08-01T00:44:49.801Z",
    "comentarios": "",
    "ejercicios": [
        {
            "nro": 1,
            "ejercicio": {
                "idEjercicio": 4137,
                "nombre": "RONDA DE INICIACIÓN (o RONDA DE INTEGRACIÓN INICIAL)",
                "idGrupo": 50,
                "grupo": "LAS RONDAS",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 4913,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 1,
                "nroPista": 18,
                "nombre": "Estamos chegando",
                "interprete": "M Nascimento",
                "duracion": "00:03:39",
                "archivo": "IBF1-18  Estamos chegando      M Nascimento (Ronda de inicio) 3, 39.mp3",
                "carpeta": "IBF01- RONDAS DE INICIO",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 2,
            "ejercicio": {
                "idEjercicio": 4152,
                "nombre": "MARCHA FISIÓLOGICA",
                "idGrupo": 51,
                "grupo": "LA MARCHA",
                "detalle":
                    "Descripción :<br/><br/>Se trata de marchar estirando al principio el paso, de manera a acentuar el movimiento de los glúteos, volviendo luego a una marcha en la cual la longitud del paso es mas habitual y natural.<br/><br/>Objetivo :<br/><br/>Rehabilitación de la marcha natural, integrando en el caminar el movimiento de los glúteos. Inicialmente se trata de caminar alargando los pasos para acentuar el movimiento de los glúteos, volviendo enseguida a caminar con pasos naturales. No se trata de un caminar danzante.<br/><br/>La restauración de la marcha fisiológica regulariza la función motora integral, restableciendo el tono apropiado no sólo de las piernas, sino también de la pelvis, del pecho, de los músculos cervicales y faciales. Además restablece las curvaturas normales de la columna vertebral, induce cambios en el metabolismo y en las funciones genito-urinaria y cardio-respiratoria. Además tiene el efecto de aumentar la confianza en sí mismo.<br/><br/>Note CIMEB :<br/><br/>Se tarta de mobilizar el cuerpo entero, acentuando la ondulación de la pelvis y de los músculos de los glúteos. Se aconseja caminar acentuando el empuje sobre la pierna de apoyo, como si se quisiera empujar el piso. También se puede aconsejar mover un glúteo contra otro a cada paso.<br/><br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5004,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 6,
                "nroPista": 1,
                "nombre": "Doctor Jazz",
                "interprete": "Tradicional Jazz Band",
                "duracion": "00:03:41",
                "archivo": "IBF6-01 Doctor Jazz         Tradicional Jazz Band   (Marcha Sinérgica)  3,41.mp3",
                "carpeta": "IBF06- Coordinación Sincronización Rit en pareja",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 3,
            "ejercicio": {
                "idEjercicio": 4170,
                "nombre": "COORDINACIÓN RÍTMICA EN PARES (llamado también “Caminar en pares”)",
                "idGrupo": 53,
                "grupo": "DANZAS VARIAS",
                "detalle":
                    "Descripción :<br/><br/>Caminar con el otro tomados de las manos siguiendo el ritmo de la música. El facilitador propone varias veces el cambio de pareja.<br/>Objetivo :<br/><br/>Caminar en perfecta coordinación con otra persona, manteniendo el mismo ritmo y una sintonía recíproca.<br/><br/>Desarrollar la capacidad de sintonizarse con el otro y de sensibilizarse a su presencia.<br/><br/>Proyección Existencial :<br/><br/>Estimular la capacidad de crear el camino juntos. Salir del individualismo, de hacer su camino solo, para dirigirse hacia la complementaridad.<br/><br/>\f<br/><br/><br/><br/>Note CIMEB :<br/><br/>La Coordinacion Ritmica en pares es una posibilidad de dialogar con el otro: ir la encuentro de su ritmo, proponerle el nuestro, y adaptarnos ambos. Si dos personas se sienten incómodas en el caminar juntas, pueden tomar iniciativas como cambiar de mano, de dirección, encontrar como mejorar la situación.<br/><br/>Podemos desdramatizar la difucultad diciendo que no siempre es fácil encontrar la sintonía, que a veces resulta \"creativo\" o \"caótico\" con diferentes personas pero que lo esencial es saborear el placer de descubrir esta relación conjunta que es la coordinación.<br/><br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5009,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 6,
                "nroPista": 6,
                "nombre": "El hombre que yo amo",
                "interprete": "Jazz Caliente",
                "duracion": "00:03:54",
                "archivo": "IBF6-06 El hombre que yo amo Jazz Caliente (Cordinac rit en par) 3,54.mp3",
                "carpeta": "IBF06- Coordinación Sincronización Rit en pareja",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 4,
            "ejercicio": {
                "idEjercicio": 4182,
                "nombre": "VARIACIONES RÍTMICAS",
                "idGrupo": 53,
                "grupo": "DANZAS VARIAS",
                "detalle":
                    "Descripción :<br/><br/>Los participantes caminan rítmicamente para calentar sus músculos y después saltan rítmicamente con sinergía. La danza se crea sobre la base de cuatro movimientos:<br/>caminar con ritmo,<br/><br/>saltar con ritmo y sinergía,<br/>saltar con giros sobre sí mismo y con los brazos abiertos,<br/><br/>saltar con abertura lateral de las piernas y movimientos simultáneos de los brazos, que se abren y se cierran sobre el pecho, mirando el pie que se levanta en forma simultánea.<br/>Objetivo :<br/><br/>Adquirir un repertorio de movimientos rítmicos para introducir un elemento de creatividad en la propia danza; estimular la vitalidad (alegría de vivir).<br/><br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5028,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 7,
                "nroPista": 3,
                "nombre": "Tiger rag",
                "interprete": "Tradicional Jazz Band",
                "duracion": "00:03:17",
                "archivo": "IBF 7-03 Tiger rag Tradicional Jazz Band 3,17.mp3",
                "carpeta": "IBF07- Ritmo Sinergismo Desplazamiento con levedad",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 5,
            "ejercicio": {
                "idEjercicio": 4206,
                "nombre": "FLUIDEZ : SERIE I",
                "idGrupo": 55,
                "grupo": "LA FLUIDEZ",
                "detalle":
                    "La Serie de Fluidez 1 estimula la conexión consigo mismo.<br/><br/>Los movimientos de fluidez se realizan en modo lento y continuo.<br/><br/>La secuencia de fluidez prepara para una danza libre de fluidez o para otras danzas de sensibilidad o de creatividad.<br/>Objetivo :<br/><br/>Estimular la conexión consigo mismo.<br/><br/>Note CIMEB :<br/><br/>La realización de la secuencia completa, cuando es integrada, favoriza también la integración yin-yang del movimiento.<br/>Etapas de la Danza :<br/><br/>1 Posición inicial<br/><br/>Parados, los pies separados el ancho de las propias caderas, los brazos descienden naturalmente a lo largo del cuerpo.<br/><br/>\f<br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>2 Primer movimiento<br/><br/>Movimiento de manos y brazos hacia delante y arriba, el dorso de las manos hacia arriba. Los brazos deben mantener la flexibilidad al nivel de las articulaciones de la muñeca y del codo. Al llegar a la altura de los hombros, las manos giran en modo que las palmas quedan hacia delante y se inicia el movimiento de las manos y brazos hacia abajo, “acariciando el aire”. Este movimiento continúa hacia atrás hasta su límite natural y luego se continúa con el movimiento inverso, o sea hacia delante. Se debe recordar mantener la flexibilidad de los brazos, en las articulaciones de la muñeca y del codo. Acompañar con las piernas, que se flexionan y extienden de modo natural, mientras los brazos oscilan hacia delante y atrás.<br/><br/>Se repite algunas veces el primer movimiento.<br/><br/>3 Segundo movimiento<br/><br/>Manos y brazos hacia delante y arriba, y hacia abajo y atrás, alternándose el brazo izquierdo y el brazo derecho. Las piernas se pueden separar ligeramente; manteniéndolas flexibles (ver primer movimiento).<br/><br/>Se repite algunas veces el segundo movimiento.<br/><br/>4 Tercer movimiento<br/><br/>Manos y brazos hacia un lado y hacia el otro lado. Comenzando hacia la derecha, el brazo derecho se dispone en actitud “yin”, receptiva (como sosteniendo un bebé), mientras el brazo izquierdo, en actitud “yang”, lo penetra (palma de la mano abierta, hacia el lado), mientras la parte superior del tronco gira sobre la cintura. Luego se inicia el giro de la cintura hacia la izquierda, cambiando la actitud de los brazos: el brazo izquierdo será “yin” y el derecho será “yang”.<br/>5 Tercer movimiento (alternativo)<br/><br/>El giro hacia la derecha se realiza sobre el talón del pie derecho, la punta del pie elevada, pierna derecha flexionada en la rodilla. La mayor parte del peso del cuerpo está sobre el pie izquierdo, apoyado en la tierra con firmeza, mientras la pierna izquierda está ligeramente flexionada a la altura de la rodilla. El giro hacia la izquierda se inicia disponiendo el pie derecho hacia delante y apoyándolo con firmeza en la tierra. Se desplaza el peso del cuerpo sobre pierna y pie derechos. Luego continuar el giro levantando la punta del pie izquierdo, que ahora gira sobre el talón izquierdo. El movimiento de brazos y manos es el mismo ya descrito.<br/><br/>Se repite algunas veces el tercer movimiento.<br/><br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5327,
                "idColeccion": 1,
                "coleccion": "BsAs",
                "nroCd": 2,
                "nroPista": 2,
                "nombre": "Isn't a Pitty",
                "interprete": "George Harrison",
                "duracion": "00:04:49",
                "archivo": "2-Isn't it a pity (George Harrison).mp3",
                "carpeta": "02",
                "lineas": "V"
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 6,
            "ejercicio": {
                "idEjercicio": 4222,
                "nombre": "MOVIMIENTO SEGMENTARIO DE CUELLO",
                "idGrupo": 57,
                "grupo": "MOVIMIENTOS SEGMENTARIOS",
                "detalle":
                    "Descripción :<br/><br/>Girar lenta y continuamente la cabeza, con el cuello relajado, los ojos cerrados y la boca semi-abierta. Evocar la vivencia del abandono (de dejarse ir). Durante la rotación de la cabeza, es importante no forzar la extensión hacia atrás. El giro debe ser lento y dulce.<br/><br/>Objetivo :<br/><br/>Relajar la musculatura cervical. Estimulación del nervio vago (parasimpático) para inducir un estado de semi-trance. Disolver la tensión ocular, oral y del rostro en general.<br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5071,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 9,
                "nroPista": 1,
                "nombre": "Because",
                "interprete": "The Beatles",
                "duracion": "00:02:51",
                "archivo": "IBF9-01 Because The Beatles (Mov seg cuello) 2, 51.mp3",
                "carpeta": "IBF09-Fluídez Seg, Eutonía  Integ motora cenest  Respiración",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 7,
            "ejercicio": {
                "idEjercicio": 4223,
                "nombre": "MOVIMIENTO SEGMENTARIO DE HOMBROS",
                "idGrupo": 57,
                "grupo": "MOVIMIENTOS SEGMENTARIOS",
                "detalle":
                    "Descripción :<br/><br/>Hacer la rotación de los hombros desde adelante hacia atrás, con los ojos y la boca semi-abierta, evocando una vivencia de liberación, como si nos librásemos de un estado de tensión.<br/><br/>Objetivo :<br/><br/>Relajar la musculatura de los hombros y de la región dorsal, generalmente tensa por causa de los mecanismos defensivos y del sentimiento de opresión.<br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5071,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 9,
                "nroPista": 1,
                "nombre": "Because",
                "interprete": "The Beatles",
                "duracion": "00:02:51",
                "archivo": "IBF9-01 Because The Beatles (Mov seg cuello) 2, 51.mp3",
                "carpeta": "IBF09-Fluídez Seg, Eutonía  Integ motora cenest  Respiración",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 8,
            "ejercicio": {
                "idEjercicio": 4168,
                "nombre": "JUEGO DEL ABANICO CHINO EN PARES",
                "idGrupo": 52,
                "grupo": "LOS JUEGOS",
                "detalle":
                    "El abordaje de la mirada, en nuestra cultura, hace refferencia a muchos tabúes (no mires, mira hacia abajo, ¿por qué me miras ...?), porque la mirada habla de nosotros sin que nos sea siempre posible controlar los contenidos perceptibles por otras esferas que la de la razón. Lo que estamos tratando de rehabilitar en Biodanza es la comunicación natural a través de la mirada, la cual permite que entre dos personas que se restablezcan los puentes que de una apertura real a la percepción esencial. Que esa mera percepción \"objetiva\" de las cosas del mundo, se convierta en percepción vinculante.<br/><br/>Uno de los primeros enfoques es el de facilitar situaciones que son a la vez divertidas, de comunicación espontánea, y sutuaciones de disolucion de las tensiones relacionadas con la dificultad de ser sincero. Así, para esta última parte, nos basaremos sobre los movimientos segmentarios, la conexión íntima con si mismo, y todo lo que se relaciona con la expresión de las emociones: la integración motriz, afectivo-motriz y la comunicación. Teniendo cuidado de no poner demasiado énfasis en la mirada, lo que podria aumentar la dificultad.<br/><br/>\f<br/><br/><br/><br/><br/><br/><br/>Descripción :<br/><br/>Para enfatizar lo afectivo, las dos personas se ubican frente a frente y “velan” su mirada y un poco su cara con las dos manos, dejando los dedos ligeramente separados, como una suerte de biombo calado, o de abanico de encaje. A través de los intersticios, en una danza sensible, las miradas se buscan, se encuentran, a veces con acercamiento del cuerpo, otras alejándose. Poco a poco, cuando la confianza se instala por la conexión, las manos se separan, dejando aparecer una parte de la cara y de la mirada hasta mostrarse completamente. Las personas se contemplan entonces en su totalidad revelada y pueden tomarse del brazo o bailar juntos (introduciendo elementos de creatividad manteniendo la conexión de la mirada).<br/><br/>Objetivo :<br/><br/>El objetivo de esta danza es domesticar la mirada, la capacidad de mirarse, de manera progresiva y afectiva. Darse su tiempo para dejarse descubrir, permitiendo revelarse y descubrir al otro progresivamente.<br/><br/>Note CIMEB :<br/><br/>Aunque el ejercicio se llama \"juego\", no se descarta que la calidad de la vivencia debe ser de conexion, de sinceridad, de feedback en la relación. La sinceridad no es grave, pero es real. El juego es sincero. Esto es en realidad un \"juego de revelación progresiva en retroalimentación.\"<br/><br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5105,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 10,
                "nroPista": 15,
                "nombre": "Fascinacao",
                "interprete": "Elis Regina",
                "duracion": "00:03:11",
                "archivo": "IBF10-15 Fascinacao Elis Regina (Encuentros) 3,11.mp3",
                "carpeta": "IBF10-Sincr Melódica,Encuentros  Contacto sensible",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 9,
            "ejercicio": {
                "idEjercicio": 4141,
                "nombre": "RONDA DE TRANSFORMACIONES",
                "idGrupo": 50,
                "grupo": "LAS RONDAS",
                "detalle":
                    "Se forman varias Rondas de 6 personas. Cada Ronda danza con la música “Andante, la Tempesta di Mare” di Salieri, música alegre y al mismo tiempo sutil. En un cierto momento, un miembro de la Ronda pasa a otra cercana y así se establece un cambio entre las personas que permiten formar nuevas Rondas.<br/><br/>Este ejercicio despierta mucha alegría y simbólicamente representa lo que sucede en el universo, donde pequeños grupos, energías, se intercambian elementos entre ellos. Esto sucede en los distintos ciclos dinámicos del cosmos, en el cual un átomo pasa a un sistema próximo.<br/><br/>Los alumnos tienen que recibir al nuevo miembro con alegría. Esta es una danza global. Cuando uno pasa a otra Ronda, no tiene que hacerlo caminando o corriendo, sino danzando.<br/><br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 5233,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 16,
                "nroPista": 20,
                "nombre": "Andante - Sinfonia in Si bemolle Maggiore",
                "interprete": "Salieri, Francesco",
                "duracion": "00:03:44",
                "archivo": "IBF16-20.mp3",
                "carpeta": "IBF16- Danza Expresiva creativa VITALIDAD TRASCENDENCIA",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        },
        {
            "nro": 10,
            "ejercicio": {
                "idEjercicio": 4148,
                "nombre": "RONDA DE CELEBRACIÓN",
                "idGrupo": 50,
                "grupo": "LAS RONDAS",
                "detalle":
                    "<br/><br/>Se propone después de un acto importante como “el Renacimiento”, de un Desafío o al final de una clase semanal o un taller. Perfectamente se pueden usan músicas clásicas y alegres, como los “Allegri” de Vivaldi. Las personas giran tomadas de las manos y con los brazos en alto. Esta Ronda es especialmente indicada para el final de una clase o taller sobre Afectividad, donde se estimula la fraternidad. Los alumnos quedan en un estado de humor triunfante.<br/><br/>Para la Ronda de Celebración realizada en cursos dedicados a profundizar la Masculinidad Profunda se utiliza la música “Zorba”, interpretada por Mikis Theodorakis, en la cual todos los hombres danzan con mucha fuerza.<br/>",
                "coleccion": "IBF"
            },
            "musica": {
                "idMusica": 4914,
                "idColeccion": 3,
                "coleccion": "IBF",
                "nroCd": 1,
                "nroPista": 19,
                "nombre": "La primavera",
                "interprete": "Vivaldi",
                "duracion": "00:03:37",
                "archivo": "IBF1-19 La primavera                 Vivaldi            (Ronda de inicio) 3, 37.mp3",
                "carpeta": "IBF01- RONDAS DE INICIO",
                "lineas": ""
            },
            "consigna": null,
            "cometarios": null,
            "nombre": "",
            "iniciarSegundos": 0,
            "finalizarSegundos": null,
            "segundosInicioProgresivo": null,
            "segundosFinProgresivo": null,
            "pauseEmpalme": null,
            "minutosAdicionales": 0,
            "cantidadRepeticiones": 1
        }
    ],
    "V": true,
    "A": false,
    "C": false,
    "S": false,
    "T": false
};