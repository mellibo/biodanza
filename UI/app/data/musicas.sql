  DECLARE @col int = 0
  select idMusica, m.idColeccion, cm.Nombre coleccion, nroCd, nroPista, m.nombre, interprete, coalesce(duracion,'00:00:00') duracion, archivo, m.carpeta
  , case WHEN V=1 THEN 'V' ELSE '' END + case WHEN A=1 THEN 'A' ELSE '' END + case WHEN C=1 THEN 'C' ELSE '' END + case WHEN S=1 THEN 'S' ELSE '' END + case WHEN T=1 THEN 'T' ELSE '' END lineas
  FROM Musica m inner join ColeccionMusica cm on m.IdColeccion = cm.IdColeccion
  WHERE  (m.IdColeccion = @col OR @col = 0)
  FOR JSON PATH
