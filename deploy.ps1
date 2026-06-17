Write-Host "🚀 Déploiement Maison SYTAM vers Netlify..." -ForegroundColor Cyan

# Vérifier si netlify-cli est installé
$nl = Get-Command netlify -ErrorAction SilentlyContinue
if (-not $nl) {
    Write-Host "Installation de netlify-cli..." -ForegroundColor Yellow
    npm install -g netlify-cli
}

# Vérifier l'auth
$status = netlify status 2>&1
if ($status -match "Not logged in") {
    Write-Host "🔑 Connexion à Netlify demandée..." -ForegroundColor Yellow
    Write-Host "   → Une page web va s'ouvrir dans votre navigateur" -ForegroundColor Yellow
    Write-Host "   → Connectez-vous et autorisez l'accès" -ForegroundColor Yellow
    Write-Host "   → Revenez ici après validation`n" -ForegroundColor Yellow
    netlify login
}

Write-Host "📦 Déploiement en cours..." -ForegroundColor Green
netlify deploy --prod --dir="."

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Déploiement réussi !" -ForegroundColor Green
    Write-Host "🌐 https://genuine-cascaron-fc973a.netlify.app" -ForegroundColor Cyan
} else {
    Write-Host "❌ Échec du déploiement" -ForegroundColor Red
}
