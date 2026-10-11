/* Traduction du texte d'interface. Aucun média, lien ou identifiant n'est modifié. */
(() => {
  "use strict";
  const dictionaries = ["locales/fr.json?v=9", "locales/site-fr.json?v=2"];
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

  function translate(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const exact = Object.prototype.hasOwnProperty.call(dict, source) ? dict[source] : null;
    if (typeof exact === "string") return removeDuplicateLabel(exact);

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
    const pageTitle = "Kaptain's Mega Collection : personnalisez votre collection Nuvio";
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
          if (record.type === "characterData") {
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
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else start();
})();
