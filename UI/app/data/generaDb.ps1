import-module Arsoft_Sql

$checks = GI *.sql

$SqlConnection = New-Object System.Data.SqlClient.SqlConnection
$database = "biodanza" 
$connectionString = "Server=$instance;Database=$database;Integrated Security=True;"
$SqlConnection.ConnectionString =  $connectionString

$SqlConnection.Open()

$SqlCmd = New-Object System.Data.SqlClient.SqlCommand
$SqlCmd.Connection = $SqlConnection
$SqlCmd.CommandTimeout = 0


foreach ($check in $checks){
    $json = ""
	$sql = get-content $check.FullName
    $SqlCmd.CommandText = $sql
	$reader = $SqlCmd.ExecuteReader() 
    $reader.HasRows
    while ($reader.Read() )
    {
        $json = $json + $reader.getvalue(0).ToString()
    }
    $reader.Close()
    $table = $check.Name.Substring(0, $check.Name.length - 4)

    $js ="if (typeof db === 'undefined') { db = {}; }

db.$table  = $json ;
"
    $jsName = $table + ".js"
    set-Content  $jsName $js -Encoding UTF8 
}

<#
foreach ($check in $checks){
    $json = ""
	$sql = get-content $check.FullName
    $SqlCmd.CommandText = $sql
    $table = $check.Name.Substring(0, $check.Name.length - 4)
	$reader = $SqlCmd.ExecuteReader() 
    $reader.HasRows
    $js = "
    if (typeof db === 'undefined') { db = {}; }
    db.$table = [];
    ";
    while ($reader.Read() )
    {
        $json = $reader.getvalue(1).ToString().substring(1)
        $json = $json.substring(0, $json.length - 1) 
        $id = $reader.getvalue(0).ToString()
        $js = $js + "db.$table['x$id'] = $json ;" 
    }
    $reader.Close()
    $jsName = $table + ".js"
    set-Content  $jsName $js -Encoding UTF8 
}
#>