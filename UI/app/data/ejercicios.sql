SELECT  e.idEjercicio, e.nombre, e.idGrupo, replace(replace(ge.nombre,char(13),'<br/>'),'\r','<br/>') as grupo, replace(replace(e.detalle,char(13),'<br/>'),'\r','<br/>') detalle, 
    (SELECT  m.idMusica as 'idMusica', m.idColeccion as 'idColeccion', cm.Nombre  as 'coleccion', m.nroCd as 'nroCd', m.nroPista as 'nroPista', m.Nombre as 'nombre', m.interprete as 'interprete', m.duracion as 'duracion', m.archivo  as 'archivo', m.carpeta as 'carpeta'
        FROM MusicaEjercicio me 
    inner join Musica m on me.IdMusica = m.IdMusica
    inner join ColeccionMusica cm on cm.IdColeccion = m.IdColeccion
    WHERE  me.IdEjercicio = e.IdEjercicio OR me.IdEjercicio is null  FOR JSON PATH) musicas
  FROM [dbo].[Ejercicios] e 
    inner join GrupoEjercicio ge on ge.IdGrupo = e.IdGrupo
    and e.Nombre not IN (SELECT NomBreEjercicio FROM EquivalenciaEjercicios WHERE IdEjercicio < 1000)
  WHERE e.IdGrupo > 49
  Order by idgrupo, nombre
  FOR JSON PATH
