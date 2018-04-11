services.factory('testMusicaService',
[
    '$q', '$filter', 'loaderService', function ($q, $filter, loaderService) {

        var service = {
            test: function (musica, cb) {
                var audio = new Audio();
                audio.onerror = function (error) {
                    cb({
                        ok: false,
                        msg: "error al cargar archivo: " + loaderService.config().pathMusica +
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
                audio.src = loaderService.config().pathMusica + musica.coleccion + "/" + musica.carpeta + "/" + musica.archivo;
                audio.play();
            }
        }

        return service;
    }
]);

