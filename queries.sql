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
  'The great gig in the sky Pink Floid'
  

  SELECT NroCd, NroPista,CHARINDEX(':', interprete),* FROM [dbo].[Musica] where IdColeccion = 3 and (ltrim(rtrim(nombre)) = '' OR ltrim(rtrim(interprete)) = '' OR len(Archivo) <=13 OR CHARINDEX(':', interprete) >1 Or CHARINDEX(':', nombre)>1)
  select * from tempMusica
  where nrocd= 18 and NroPista= 1
  ':'