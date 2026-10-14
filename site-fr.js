/* Traduction du texte d'interface. Aucun média, lien ou identifiant n'est modifié. */
(() => {
  "use strict";
  const dictionaries = ["locales/fr.json?v=19", "locales/site-fr.json?v=26"];
  const blocked = "script,style,noscript,code,pre,textarea,[contenteditable],[contenteditable='true'],img,picture,video,audio,source,track,canvas,svg,object,embed,iframe,[data-no-translate]";
  const textAttributes = ["placeholder", "title", "aria-label", "data-tip"];
  const dict = Object.create(null);

  function prohibited(node) {
    const parent = node && (node.nodeType === 1 ? node : node.parentElement);
    return !parent || Boolean(parent.closest(blocked));
  }

  // Ne supprimer que les répétitions réelles, sans retirer les types de médias utiles.
  function removeDuplicateLabel(value) {
    return value
      .replace(/\b(Films|Séries)\s*[-–—:]\s*\1\b/gi, "$1")
      .replace(/\b(Films|Séries)\s*\(\s*\1\s*\)/gi, "$1")
      .replace(/\b(Films|Séries)\s+\1\b/gi, "$1");
  }

  function ampersandToEt(value) {
    // Seulement les textes affichés : jamais les URL, attributs src/href,
    // expressions JS, identifiants techniques ou illustrations.
    return String(value).replace(/&(?:amp;)?/g, " Et ").replace(/ {2,}/g, " ").trim();
  }
  function translate(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const exact = Object.prototype.hasOwnProperty.call(dict, source) ? dict[source] : null;
    if (typeof exact === "string") return removeDuplicateLabel(ampersandToEt(exact));
    const normalizedSource = ampersandToEt(source);
    if (normalizedSource !== source) {
      const alias = Object.prototype.hasOwnProperty.call(dict, normalizedSource)
        ? dict[normalizedSource] : normalizedSource;
      return removeDuplicateLabel(ampersandToEt(alias));
    }

    // Titres dynamiques du Studio de profils et des assistants :
    // les chiffres, noms de profils et IDs restent inchangés.
    let dyn = /^(\d+)\s+categories?\s*[·•]\s*(\d+)\s+folders?$/i.exec(source);
    if (dyn) return dyn[1] + " catégories · " + dyn[2] + " dossiers";
    dyn = /^(\d+)\s+rows?\s*[·•]\s*(\d+)\s+folders?$/i.exec(source);
    if (dyn) return dyn[1] + " rangées · " + dyn[2] + " dossiers";
    dyn = /^(\d+)\s+folders? available\s*[·•]\s*Click to add$/i.exec(source);
    if (dyn) return dyn[1] + " dossiers disponibles · Cliquer pour ajouter";
    dyn = /^📁\s*View\s+(\d+)\s+folders?$/i.exec(source);
    if (dyn) return "📁 Afficher " + dyn[1] + " dossiers";
    dyn = /^([+−-])\s*(\d+)\s+(added|removed)$/i.exec(source);
    if (dyn) return dyn[1] + " " + dyn[2] + (dyn[3].toLowerCase() === "added" ? " ajoutés" : " retirés");
    dyn = /^(Added|Removed)\s*\((\d+)\)$/i.exec(source);
    if (dyn) return (dyn[1].toLowerCase() === "added" ? "Ajoutés" : "Retirés") + " (" + dyn[2] + ")";
    dyn = /^Save Layout to ["“](.+)["”]\??$/i.exec(source);
    if (dyn) return "Enregistrer la disposition dans « " + dyn[1] + " » ?";
    dyn = /^No sources matching ["“](.+)["”]\.$/i.exec(source);
    if (dyn) return "Aucune source ne correspond à « " + dyn[1] + " ».";
    dyn = /^Sources feeding this folder\s*[·•]\s*(\d+)\/(\d+)$/i.exec(source);
    if (dyn) return "Sources de ce dossier · " + dyn[1] + "/" + dyn[2];
    dyn = /^List:\s*(.+)$/i.exec(source);
    if (dyn) return "Liste : " + dyn[1];
    // Messages comptant des éléments : ces nombres ne sont pas des identifiants.
    let m = /^(\d+)\s+of\s+(\d+)\s+folders?\s+selected$/i.exec(source);
    if (m) return m[1] + (Number(m[1]) === 1 ? " dossier sélectionné sur " : " dossiers sélectionnés sur ") + m[2];
    m = /^(\d+)\s+of\s+(\d+)\s+sources?\s+enabled$/i.exec(source);
    if (m) return m[1] + (Number(m[1]) === 1 ? " source activée sur " : " sources activées sur ") + m[2];
    m = /^(\d+)\s+collections?\s+built$/i.exec(source);
    if (m) return m[1] + (Number(m[1]) === 1 ? " collection créée" : " collections créées");
    m = /^(\d+)\s+people\s+(?:have\s+)?visited$/i.exec(source);
    if (m) return m[1] + (Number(m[1]) === 1 ? " visite" : " visites");
    m = /^Step\s+(\d+)\s+(?:of|\/)\s+(\d+)$/i.exec(source);
    if (m) return "Étape " + m[1] + " sur " + m[2];
    m = /^Save Layout to "(.+)"$/i.exec(source);
    if (m) return 'Enregistrer la disposition dans « ' + m[1] + ' »';
    if (/\b(Films|Séries)\s*[-–—:]\s*\1\b/i.test(source)) {
      return removeDuplicateLabel(source);
    }
    return null;
  }

  function translateTextNode(node) {
    if (prohibited(node)) return;
    const value = node.nodeValue;
    const source = value.trim();
    const result = translate(source);
    if (result !== null && result !== source) {
      node.nodeValue = value.replace(source, result);
    }
  }

  function translateAttributes(el) {
    if (prohibited(el)) return;
    for (const attribute of textAttributes) {
      if (!el.hasAttribute(attribute)) continue;
      const value = el.getAttribute(attribute);
      const result = translate(value);
      if (result !== null && result !== value) el.setAttribute(attribute, result);
    }
    // Pas de modification de alt, src, srcset, poster, href, style ou data-*.
  }

  function visit(root) {
    if (!root || prohibited(root)) return;
    if (root.nodeType === 3) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === 1 && prohibited(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateTextNode(node);
      else translateAttributes(node);
    }
  }

  function start() {
    document.documentElement.lang = "fr";
    const pageTitle = "Ma-Collection : catalogues pour Kovelyx et Nuvio";
    if (document.title.includes("Build Your Custom Nuvio Setup")) document.title = pageTitle;
    Promise.allSettled(dictionaries.map(path =>
      fetch(path).then(response => {
        if (!response.ok) throw new Error("Dictionnaire indisponible : " + path);
        return response.json();
      })
    )).then(results => {
      // Le dictionnaire du site est prioritaire sur celui des catalogues.
      for (const result of results) {
        if (result.status === "fulfilled") Object.assign(dict, result.value);
        else console.warn("Traduction française :", result.reason);
      }
      visit(document.body);
      const pending = new Set();
      let scheduled = false;
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "characterData" || record.type === "attributes") {
            pending.add(record.target);
          } else {
            for (const node of record.addedNodes) pending.add(node);
          }
        }
        if (scheduled || !pending.size) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const nodes = Array.from(pending);
          pending.clear();
          for (const node of nodes) {
            if (node.isConnected) visit(node);
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: textAttributes });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else start();
})();
