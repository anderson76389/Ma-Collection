#!/usr/bin/env node
/**
 * Connexion TMDB V4 sur le PC de l'utilisateur, sans compte partagé.
 * Autorisation via le site officiel TMDB, secret ensuite enregistré dans GitHub.
 * Le token ne sera pas affiché sauf avec --print-token explicite.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr } from 'node:process';
import { spawnSync } from 'node:child_process';

const api='https://api.themoviedb.org/4';
const readToken=String(process.env.TMDB_V4_READ_TOKEN||'').trim();
if (!readToken) {
  console.error('Renseigne TMDB_V4_READ_TOKEN depuis ton compte TMDB > Paramètres > API (API Read Access Token).');
  process.exit(2);
}
async function req(path,body) {
  const res=await fetch(api+path,{method:'POST',
    headers:{Authorization:'Bearer '+readToken,Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await res.json();
  if(!res.ok||data.success===false)throw Error('TMDB a refusé l’autorisation : '+(data.status_message||res.status));
  return data;
}
const rl=createInterface({input:stdin,output:stdout});
try{
  const temp=await req('/auth/request_token',{});
  if(!temp.request_token)throw Error('TMDB ne donne pas de request_token');
  const link='https://www.themoviedb.org/auth/access?request_token='+encodeURIComponent(temp.request_token);
  console.log('\n1. Connecte-toi à TON compte TMDB et autorise Ma-Collection :\n'+link);
  console.log('   Le lien d’autorisation expire en 15 minutes.\n');
  await rl.question('2. Après approbation dans le navigateur, appuie sur Entrée ici : ');
  const user=await req('/auth/access_token',{request_token:temp.request_token});
  if(!user.access_token||!user.account_id)throw Error('Autorisation invalide : aucun accès utilisateur');
  console.log('3. Compte TMDB autorisé. Installation du secret dans GitHub...');
  const result=spawnSync('gh',['secret','set','TMDB_V4_USER_ACCESS_TOKEN','--repo','anderson76389/Ma-Collection'],
    {input:user.access_token+'\n',encoding:'utf8',stdio:['pipe','inherit','inherit']});
  if(result.error||result.status!==0) {
    console.error('GitHub CLI non configuré. Connecte-toi avec gh auth login puis relance la procédure.');
    if(process.argv.includes('--print-token')) {
      console.error('ATTENTION : affichage local volontaire du jeton, ne le partage jamais.');
      console.log('TMDB_V4_USER_ACCESS_TOKEN='+user.access_token);
    } else {
      console.error('Pour une saisie manuelle du secret GitHub, relance en ajoutant --print-token.');
    }
    process.exitCode=1;
  } else console.log('Autorisation enregistrée dans GitHub Secrets. Ne communique jamais ce jeton.');
}catch(e){console.error('Connexion non terminée : '+e.message);process.exitCode=1}
finally{rl.close();}
