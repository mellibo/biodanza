/****** Script for SelectTopNRows command from SSMS  ******/
SELECT 
      DISTINCT lower([NombreEjercicio])
      ,[NombreEjercicioIbf]
  FROM [Biodanza].[dbo].[EquivalenciaEjercicios]
  where lower([NombreEjercicioIbf]) != lower([NombreEjercicio])
  and len([NombreEjercicioIbf]) > 2 and len([NombreEjercicio]) > 2
  ORDER BY 1