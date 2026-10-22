/**
 * Canaux partenaires locaux de Ma-Collection.
 * Les archives bêta Kaptain v0.90/v0.91/v0.92 sont retirées.
 * L'import Kaoxt est conservé sans requête vers un serveur Kaptain.
 */
window.MA_COLLECTION_TEST_CHANNELS = {
  // Collection partenaire Kaoxt — MDBList / AIO Metadata, conservée à l'identique
  // Key must be uppercase: lookupTestChannel normalizes input with toUpperCase().
  KAOXTV1: {
    id: 'KaoxtV1',
    label: 'Kaoxt Collection',
    versionLabel: 'Friends · Kaoxt',
    blurb: "Kaoxt's collection, ready to browse and import into Kovelyx.",
    databaseUrl: 'collections/database.kaoxt.js',
    templateUrl: null,
    friendPack: {
      id: 'kaoxt',
      creatorName: 'Kaoxt',
      aioCatalogsUrl: 'collections/kaoxt-aio-catalogs.json',
      aioBaseConfigUrl: 'collections/kaoxt-aio-base-config.json',
    },
    redditFeedbackUrl: 'https://github.com/anderson76389/Ma-Collection/issues/new',
    redditCommunityUrl: 'https://github.com/anderson76389/Ma-Collection/discussions',
    patchNotes: {
      title: 'Kaoxt Collection',
      intro:
        "You're in Kaoxt's collection, using Ma-Collection's picker. The lists run on AIO Metadata (MDBList). When you Importer dans Kovelyx, this tool installs those catalogs for whatever you picked. Ma-Collection stays as it was until you tap Exit Friends.",
      bullets: [
        "Browse and edit Kaoxt's folders the same way you do in Ma-Collection",
        'Importer dans Kovelyx installs Kaoxt\'s AIO Metadata catalogs for your selection',
        'You need an MDBList API key (free at mdblist.com) for the lists to load',
        'Kaoxt\'s "For You" folder uses Bingecat. Paste your own Bingecat manifest if you keep that folder',
      ],
      feedback:
        'Questions or bugs with this Friends preview? Ouvrez une issue sur le GitHub Ma-Collection. Collection content feedback goes to Kaoxt.',
    },
  },
};
