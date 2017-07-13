  select idMusica, m.idColeccion, cm.Nombre coleccion, nroCd, nroPista, m.nombre, interprete, duracion, archivo, m.carpeta 
  FROM Musica m inner join ColeccionMusica cm on m.IdColeccion = cm.IdColeccion
  FOR JSON PATH
