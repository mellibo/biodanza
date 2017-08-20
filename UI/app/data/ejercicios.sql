SELECT e.idEjercicio, e.nombre, e.idGrupo, replace(replace(ge.nombre,char(13),'<br/>'),'\r','<br/>') as grupo, replace(replace(e.detalle,char(13),'<br/>'),'\r','<br/>') detalle, cm.nombre coleccion, 
JSON_QUERY(dbo.ufnToRawJsonArray(
    (SELECT  convert(varchar(19), m.idMusica) as 'idMusica'
        FROM MusicaEjercicio me 
    inner join Musica m on me.IdMusica = m.IdMusica
    inner join ColeccionMusica cm on cm.IdColeccion = m.IdColeccion
    WHERE  me.IdEjercicio = e.IdEjercicio OR me.IdEjercicio is null  FOR JSON PATH), 'idMusica')) as 'musicasId'
  FROM [dbo].[Ejercicios] e 
    inner join GrupoEjercicio ge on ge.IdGrupo = e.IdGrupo
    inner join ColeccionMusica cm on cm.IdColeccion = e.IdColeccion
    and e.Nombre not IN (SELECT NomBreEjercicio FROM EquivalenciaEjercicios WHERE IdEjercicio < 1000)
  WHERE e.IdGrupo > 49
  Order by idgrupo, e.nombre
  FOR JSON PATH
