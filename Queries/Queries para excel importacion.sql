SELECT Nombre FROM Ejercicios e
WHERE e.IdGrupo > 49 
    and e.Nombre not IN (SELECT NomBreEjercicio FROM EquivalenciaEjercicios WHERE IdEjercicio < 1000)

SELECT DISTINCT Interprete FROM Musica