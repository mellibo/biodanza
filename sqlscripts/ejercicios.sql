use [Biodanza]

SELECT TOP (1000) e.idEjercicio, e.nombre, e.idGrupo, ge.nombre grupo, e.detalle, m.idMusica, m.idColeccion, cm.Nombre coleccion, m.nroCd, m.nroPista, m.Nombre musica, m.interprete, convert(varchar(5),m.duracion ,100 ) duracion, m.archivo, m.carpeta
  FROM [dbo].[Ejercicios] e 
    inner join MusicaEjercicio me on me.IdEjercicio = e.IdEjercicio
    inner join Musica m on me.IdMusica = m.IdMusica
    inner join ColeccionMusica cm on cm.IdColeccion = m.IdColeccion
    inner join GrupoEjercicio ge on ge.IdGrupo = e.IdGrupo
  where e.IdEjercicio > 300
  Order by 1
  FOR JSON PATH

  --SELECT '{ idGrupo : ' + cast(IdGrupo as varchar(50)) + ', Nombre : ''' + Nombre + ''' }, '  FROM GrupoEjercicio WHERE IdGrupo >=50

  SELECT e.idEjercicio, e.nombre, e.idGrupo, ge.nombre grupo, e.detalle
  FROM [dbo].[Ejercicios] e 
    inner join GrupoEjercicio ge on ge.IdGrupo = e.IdGrupo
  where e.IdEjercicio > 300
  Order by 1
  FOR JSON PATH

  select idMusica, idColeccion, nroCd, nroPista, nombre, interprete, duracion, archivo, carpeta FROM Musica
  FOR JSON PATH

