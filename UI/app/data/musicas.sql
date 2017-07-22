  select idMusica, m.idColeccion, cm.Nombre coleccion, nroCd, nroPista, m.nombre, interprete, duracion, archivo, m.carpeta
  , case WHEN V=1 THEN 'V' ELSE '' END + case WHEN A=1 THEN 'A' ELSE '' END + case WHEN C=1 THEN 'C' ELSE '' END + case WHEN S=1 THEN 'S' ELSE '' END + case WHEN T=1 THEN 'T' ELSE '' END lineas
  FROM Musica m inner join ColeccionMusica cm on m.IdColeccion = cm.IdColeccion
  FOR JSON PATH
