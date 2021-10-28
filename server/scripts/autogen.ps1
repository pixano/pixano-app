[CmdletBinding()]
param (
    [Parameter()]
    [string]
    $Serie
)

if (!$Serie) {
    $Serie = Read-Host "Please enter the image serie name"
}

$SeriePath = Join-Path (Get-Location) $Serie

if (!(Test-Path -Path $SeriePath -PathType Container)) {
    Write-Error "The serie does'nt exists."
    exit
}

Set-Location $SeriePath

$FirstLaunch = !(Test-Path .\db.ldb -PathType Container)

if (!(Test-Path .\images -PathType Container)) {
    New-Item -Path "." -Name "images" -ItemType "directory"
}

Move-Item -Path .\*.jpg -Destination .\images\
Move-Item -Path .\*.png -Destination .\images\

$pixanoId = docker ps -a -f "name=pixano" -f "status=running" -q

if ($pixanoId) {
    Write-Host "Stopping previous instance of pixano..."
    $pixanoId = docker stop $pixanoId
    Write-Host "Previous instance of pixano #" $pixanoId " is stopped."
}

$pixanoId = docker ps -a -f "name=pixano" -q

if ($pixanoId) {
    Write-Host "Removing previous instance of pixano..."
    $pixanoId = docker rm $pixanoId
    Write-Host "Previous instance of pixano #" $pixanoId " is removed."
}

Write-Host "Starting pixano..."
$pixanoId = docker run -d --name pixano -v ${pwd}:/data -p 3000:3000 pixano/pixano-app

Write-Host "Pixano #" $pixanoId " is started."
Start-Sleep -s 1

if ($FirstLaunch) {
    Write-Host "Configuring pixano..."
    Start-Sleep -s 1

    $PixanoUrl = 'http://localhost:3000/api/v1'
    $BodyLogin = @{
        username = 'admin'
        password = 'admin'
    }
    $LoginResponse = Invoke-WebRequest -UseBasicParsing "$PixanoUrl/login/" -SessionVariable 'Session' -Body $BodyLogin -Method 'POST'
    if ($LoginResponse.StatusCode -eq 200) {
        Write-Host "Login admin ok."
    }
    else {
        Write-Error $LoginResponse
        Write-Error $Session
    }

    $ProfileResponse = Invoke-WebRequest -UseBasicParsing "$PixanoUrl/profile/" -WebSession $Session
    if ($ProfileResponse.StatusCode -eq 200) {
        Write-Host "Get admin profile ok."
    }
    else {
        Write-Error $ProfileResponse
    }

    $BodySignup = @{
        username    = 'john'
        password    = 'root'
        role        = 'admin'
        preferences = @{
            theme = 'white'
        }
    }
    $CreateUserResponse = Invoke-WebRequest -UseBasicParsing "$PixanoUrl/users/" -WebSession $Session -Body ($BodySignup | ConvertTo-Json -Depth 9) -Method 'POST' -ContentType "application/json"
    if ($CreateUserResponse.StatusCode -eq 201) {
        Write-Host "john user created."
    }
    else {
        Write-Error $CreateUserResponse
    }

    $BodySignup = @{
        username    = 'jane'
        password    = 'root'
        role        = 'admin'
        preferences = @{
            theme = 'white'
        }
    }
    $CreateUserResponse = Invoke-WebRequest -UseBasicParsing "$PixanoUrl/users/" -WebSession $Session -Body ($BodySignup | ConvertTo-Json -Depth 9) -Method 'POST' -ContentType "application/json"
    if ($CreateUserResponse.StatusCode -eq 201) {
        Write-Host "jane user created."
    }
    else {
        Write-Error $CreateUserResponse
    }

    $BodyTask = Get-Content -Path ..\task.json
    $CreateTaskResponse = Invoke-WebRequest -UseBasicParsing "$PixanoUrl/tasks" -WebSession $Session -Body $BodyTask -Method 'POST' -ContentType "application/json"
    if ($CreateTaskResponse.StatusCode -eq 201) {
        Write-Host "Task created."
    }
    else {
        Write-Error $CreateTaskResponse
    }
}

Write-Host "Launching pixano interface..."
Start-Process -FilePath Chrome -ArgumentList http://localhost:3000