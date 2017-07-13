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
    set-Content  $jsName $js
}

