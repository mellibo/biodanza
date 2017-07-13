SELECT idGrupo, nombre FROM GrupoEjercicio
WHERE IdGrupo > 30 OR IdGrupo = 0
ORDER BY 1
FOR JSON PATH	 

