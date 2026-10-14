/* Mise en forme des libellés de sous-catégories ; aucun identifiant n'est modifié. */
(function (root) {
  "use strict";
  const complements = {
    action:"d'action", adventure:"d'aventure", aventure:"d'aventure",
    comedy:"comiques", comédie:"comiques", crime:"policiers", policier:"policiers",
    drama:"dramatiques", drame:"dramatiques", horror:"d'horreur", horreur:"d'horreur",
    thriller:"à suspense", romance:"romantiques", fantasy:"fantastiques",
    fantastique:"fantastiques", "sci-fi":"de science-fiction",
    "science-fiction":"de science-fiction", "science fiction":"de science-fiction",
    animation:"d'animation", anime:"d'animation japonaise", animé:"d'animation japonaise",
    documentary:"documentaires", documentaire:"documentaires",
    mystery:"à énigmes", mystère:"à énigmes", war:"de guerre", guerre:"de guerre",
    western:"westerns", history:"historiques", histoire:"historiques",
    family:"familiaux", famille:"familiaux", music:"musicaux", musique:"musicaux",
    sport:"de sport", sports:"de sport"
  };
  const genrePart = "(Action|Adventure|Aventure|Comedy|Comédie|Crime|Policier|Drama|Drame|Horror|Horreur|Thriller|Romance|Fantasy|Fantastique|Sci-Fi|Science-Fiction|Science Fiction|Animation|Anime|Animé|Documentary|Documentaire|Mystery|Mystère|War|Guerre|Western|History|Histoire|Family|Famille|Music|Musique|Sports?)";
  const mediaPart = "(Films?|Movies?|Séries?|Series|Animés?|Animes?)";
  const endGenre = new RegExp("^"+genrePart+"\\s+"+mediaPart+"$","i");
  const startGenre = new RegExp("^"+mediaPart+"\\s+"+genrePart+"$","i");
  function media(fr) {
    if (/^(?:films?|movies?)$/i.test(fr)) return "Films";
    if (/^(?:séries?|series)$/i.test(fr)) return "Séries";
    return "Animés";
  }
  function naturalizeTitle(value) {
    if (typeof value !== "string") return value;
    let label=value.replace(/&(?:amp;)?/g," Et ").replace(/\s+/g," ").trim();
    const director=/^(.+?)\s*\(\s*films (incontournables|récents)\s*\)$/i.exec(label);
    if (director) label="Films "+director[2]+" : "+director[1];
    label=label.replace(/\s*\(\s*(?:Films?|Séries?|Animés?|Animes?|Movies?|Series)\s*\)/gi,"");
    label=label.replace(/\s*\(\s*([^()]*)\s*\)/g,(full,content)=>{
      const t=content.trim();
      if(!t) return "";
      // Abréviation officielle : ABC TV (AU).
      return /^[A-Z]{2,4}$/.test(t) ? full : " — "+t;
    });
    label=label.replace(/\b(Films|Séries|Animés)\s*[-–—:]\s*\1\b/gi,"$1")
      .replace(/\b(Films|Séries|Animés)\s+\1\b/gi,"$1");
    const match=endGenre.exec(label)||startGenre.exec(label);
    if (match) {
      const genre=match===null?"":(endGenre.test(label)?match[1]:match[2]);
      const kind=endGenre.test(label)?match[2]:match[1];
      label=media(kind)+" "+complements[genre.toLocaleLowerCase("fr")];
    }
    return label.replace(/\s{2,}/g," ").replace(/\s+—\s+—\s+/g," — ").trim();
  }
  root.MaCollectionFrenchLabels=Object.freeze({naturalizeTitle});
  if(typeof module!=="undefined"&&module.exports)module.exports={naturalizeTitle};
})(typeof window!=="undefined"?window:globalThis);
