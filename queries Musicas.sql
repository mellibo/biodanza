use [Biodanza]

/****** Script for SelectTopNRows command from SSMS  ******/
SELECT TOP (1000)*
  FROM [dbo].[Musica] where IdColeccion = 3

  select distinct 'ret.Add("' + Interprete  + '","' + Interprete  + '"); ' FROM Musica --where --IdColeccion = 3
  ORDER BY LEN(interprete) DESC

  

  drop Table Interpretes

  select distinct Interprete , Interprete NombreCorrecto into Interpretes FROM Musica --where --IdColeccion = 3
  ORDER BY LEN(interprete) DESC
  select *  from musica where Archivo like '%pia%'
  -- delete tOP (1 ) FROM Interpretes where Interprete = 'G Haririson'
  'IBF 7-21 Danubio blue J Strauss (Desplaz con levedad  y cord) 3, 04.mp3'