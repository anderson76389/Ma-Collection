#Requires -Version 5.1
<#
  Ma-Collection : autorisation TMDB V4 pour Windows 10/11.
  Ne requiert ni Git, ni Node.js, ni GitHub CLI.
  Ne cree aucune liste et ne modifie aucune collection.
  Le jeton utilisateur est transfere au coffre GitHub Secrets via le presse-papiers.
  ATTENTION : vider le presse-papiers apres l'enregistrement.
#>
[CmdletBinding()]
param([switch]$Check)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Ma-Collection - Connexion TMDB'
$secretName = 'TMDB_V4_USER_ACCESS_TOKEN'
$secretsUrl = 'https://github.com/anderson76389/Ma-Collection/settings/secrets/actions/new'
$tmdbSettings = 'https://www.themoviedb.org/settings/api'
$api = 'https://api.themoviedb.org/4'
$clipContainsSecret = $false

function Say([string]$Text) {
    Write-Host $Text -ForegroundColor Cyan
}
function Warn([string]$Text) {
    Write-Host $Text -ForegroundColor Yellow
}
function Open-Page([string]$Url) {
    try { Start-Process -FilePath $Url -ErrorAction Stop | Out-Null }
    catch { Warn "Ouvre cette adresse toi-meme : $Url" }
}
function Post-Tmdb([string]$Path, [string]$ReadToken, $Body) {
    $json = ConvertTo-Json -InputObject $Body -Depth 10 -Compress
    try {
        return Invoke-RestMethod -Uri ($api + $Path) -Method Post -ContentType 'application/json' -Headers @{
            Authorization = ('Bearer ' + $ReadToken)
            Accept = 'application/json'
        } -Body $json -TimeoutSec 40
    } catch {
        $status = ''
        if ($_.Exception.Response) {
            try { $status = [string][int]$_.Exception.Response.StatusCode } catch {}
        }
        if ($status -eq '401') {
            throw "TMDB refuse le jeton (HTTP 401). Utilise l'API READ ACCESS TOKEN, pas la cle API v3."
        }
        if ($status -eq '403') {
            throw "TMDB refuse l'autorisation (HTTP 403). Verifie le compte TMDB et l'autorisation dans le navigateur."
        }
        if ($status) { throw "Erreur TMDB HTTP $status. Verifie ton token ou relance plus tard." }
        throw "Impossible de contacter TMDB : $($_.Exception.Message)"
    }
}
function Get-ReadToken {
    $secure = Read-Host "Colle ton API Read Access Token TMDB (saisie masquee)" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        $secure.Dispose()
    }
}
if ($Check) {
    Say "Windows PowerShell : $($PSVersionTable.PSVersion)"
    $test = Get-Command 'Invoke-RestMethod' -ErrorAction SilentlyContinue
    $clip = Get-Command 'Set-Clipboard' -ErrorAction SilentlyContinue
    if ($test -and $clip) {
        Say "VERIFICATION OK : aucune installation supplementaire necessaire."
        exit 0
    }
    throw "PowerShell incomplet : Invoke-RestMethod ou Set-Clipboard absent."
}

try {
    # PowerShell 5.1 sous Windows peut necessiter TLS 1.2 explicite.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    Say ''
    Say '=== Ma-Collection : connexion TMDB sur Windows ==='
    Write-Host "Tu n'as besoin ni de Git, ni de Node, ni de GitHub CLI."
    Write-Host "Aucun film, catalogue ou fichier GitHub ne sera modifie."
    Say ''
    Write-Host '1) Recupere le champ API Read Access Token sur :'
    Write-Host $tmdbSettings
    Open-Page $tmdbSettings
    $readToken = Get-ReadToken
    if (!$readToken) { throw "Aucun jeton saisi." }
    if ($readToken.Length -lt 40) {
        throw "Jeton trop court. Il faut l'API Read Access Token (chaine longue), pas une cle API v3 de 32 caracteres."
    }
    Say ''
    Write-Host '2) Demande une autorisation temporaire a TMDB...'
    $request = Post-Tmdb '/auth/request_token' $readToken @{}
    $requestToken = [string]$request.request_token
    if (!$requestToken) { throw "TMDB n'a pas fourni de request_token." }

    $approveUrl = 'https://www.themoviedb.org/auth/access?request_token=' + [Uri]::EscapeDataString($requestToken)
    Say ''
    Write-Host '3) Autorise l acces dans ton navigateur (expiration : 15 minutes) :'
    Write-Host $approveUrl
    Open-Page $approveUrl
    [void](Read-Host "Clique AUTORISER sur TMDB, puis reviens ici et appuie sur Entree")
    $user = Post-Tmdb '/auth/access_token' $readToken @{ request_token = $requestToken }
    $userToken = [string]$user.access_token
    if (!$userToken -or !$user.account_id) {
        throw "TMDB ne confirme pas l'autorisation de ton compte. Recommence apres validation."
    }
    $readToken = $null
    $requestToken = $null

    Say ''
    Say '4) Ton compte TMDB est autorise.'
    Write-Host "Je copie temporairement le jeton utilisateur dans le presse-papiers."
    Set-Clipboard -Value $userToken
    $clipContainsSecret = $true
    $userToken = $null
    Write-Host "J'ouvre les secrets de ton depot GitHub :"
    Write-Host $secretsUrl
    Open-Page $secretsUrl
    Say ''
    Write-Host 'Dans GitHub, clique New repository secret si necessaire.'
    Write-Host "Name  : $secretName"
    Write-Host 'Secret: CTRL+V (jeton deja copie, ne le communique a personne)'
    Write-Host 'Clique Add secret pour confirmer.'
    [void](Read-Host "Une fois le secret SAUVE dans GitHub, reviens ici et appuie sur Entree")
    Set-Clipboard -Value ''
    $clipContainsSecret = $false

    Say ''
    Say 'TERMINE : le secret a ete propose pour enregistrement.'
    Write-Host "Verifie maintenant qu'il apparait sous le nom $secretName dans GitHub."
    Write-Host 'Puis lance Actions > TMDB - Copier les listes vers mon compte > Run workflow.'
    Write-Host 'Choisis operation=copy, scope=people, max_lists=1 pour commencer prudemment.'
} catch {
    Write-Host ''
    Write-Host ("ERREUR : " + $_.Exception.Message) -ForegroundColor Red
    Warn 'Aucune liste ou collection n a ete modifiee.'
    Warn 'Si besoin, copie uniquement ce message d erreur, jamais tes jetons TMDB.'
    exit 1
} finally {
    if ($clipContainsSecret) {
        Warn 'Attention : un jeton sensible est encore dans le presse-papiers.'
        Warn "Efface-le apres l'avoir sauvegarde dans GitHub."
    }
}
