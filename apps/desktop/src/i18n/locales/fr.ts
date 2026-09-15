/**
 * Français. Toute clé ici doit aussi exister en anglais — vérifié par `i18n.test.ts`. Une clé
 * absente retombe simplement sur l'anglais ; une traduction incertaine n'est pas incluse.
 */

import type { Messages } from '../index';

const fr: Messages = {
  common: {
    close: 'Fermer',
    dismiss: 'Ignorer',
    choose: 'Choisir…',
    itCannot: 'Il ne peut pas',
    recordingBadge: 'enregistrement',
  },

  sidebar: {
    ariaLabel: 'Sections',
    running: ', en cours d’exécution',
    items: {
      home: 'Accueil',
      builder: 'Constructeur',
      library: 'Bibliothèque',
      components: 'Composants',
      security: 'Sécurité',
      settings: 'Réglages',
    },
  },

  home: {
    intro: {
      heading: 'Construisez des logiciels à partir de pièces qui s’assemblent.',
      body: 'Placez des composants sur un canevas, reliez-les, puis démarrez. Tout s’exécute sur cette machine, et rien n’accède à vos fichiers sans autorisation demandée au préalable.',
    },
    actions: {
      new: {
        title: 'Nouveau flux de travail',
        detail: 'Partir d’un canevas vide',
      },
      open: {
        title: 'Ouvrir',
        detailReady: 'Un fichier .encastra enregistré précédemment',
        detailUnavailable: 'Nécessite l’application de bureau',
      },
      library: {
        title: 'Ouvrir depuis votre bibliothèque',
        detail: 'Ce que vous avez créé, reçu ou préparé',
      },
      browse: {
        title: 'Parcourir les composants',
        detail: {
          one: '{count} installé, et ce qu’il peut atteindre',
          other: '{count} installés, et ce que chacun peut atteindre',
        },
      },
    },
    continue: {
      heading: 'Là où vous en étiez',
      steps: {
        one: '{count} étape',
        other: '{count} étapes',
      },
      unsaved: ' · pas encore enregistré',
    },
    samples: {
      heading: 'Exemples',
      note: 'De vrais flux de travail sur le vrai moteur d’exécution. Chacun exige que vous choisissiez ses dossiers avant de pouvoir démarrer — un exemple qui écrirait quelque part que vous n’auriez pas choisi irait à l’exact opposé du principe.',
      needs: 'Nécessite : {list}',
    },
  },

  palette: {
    title: 'Composants',
    empty: 'Aucun composant n’est installé.',
    asksTo: 'Demande à : {list}',
    capabilities: {
      fsRead: 'lire des fichiers',
      fsWrite: 'écrire des fichiers',
      netHttp: 'utiliser le réseau',
      systemNotify: 'afficher des notifications',
      systemClipboard: 'utiliser le presse-papiers',
    },
  },

  canvas: {
    ariaLabel: 'Canevas du flux de travail',
    refusal: {
      selfCycle: {
        headline: 'Une étape ne peut pas s’alimenter elle-même.',
        detail:
          'Un flux de travail s’exécute vers l’avant. Pour répéter le même travail plusieurs fois, démarrez-le depuis un déclencheur — Surveiller un dossier ou Minuteur — qui l’exécute une fois par événement.',
      },
      bridge: 'Une étape produisant {bridge} entre les deux les relierait.',
      // Chaque formulation dont un refus est composé — voir `canvas/refusal.ts`.
      cannotFeed: '{from} ne peut pas alimenter une étape qui attend {to}.',
      rawType: '« {name} »',
      listOf: 'une liste de valeurs de type {item}',
      optional: 'une valeur facultative de type {item}',
      types: {
        bool: 'un booléen',
        i64: 'un entier',
        f64: 'un nombre',
        string: 'du texte',
        json: 'du JSON',
        file: 'un fichier',
        dir: 'un dossier',
        bytes: 'des octets',
        image: 'une image',
        video: 'une vidéo',
        audio: 'du son',
      },
      nouns: {
        bool: 'booléen',
        i64: 'entier',
        f64: 'nombre',
        string: 'texte',
        json: 'JSON',
        file: 'fichier',
        dir: 'dossier',
        bytes: 'octets',
        image: 'image',
        video: 'vidéo',
        audio: 'son',
      },
      labels: {
        bool: 'Booléen',
        i64: 'Entier',
        f64: 'Nombre',
        string: 'Texte',
        json: 'JSON',
        file: 'Fichier',
        dir: 'Dossier',
        bytes: 'Octets',
        image: 'Image',
        video: 'Vidéo',
        audio: 'Audio',
      },
      detail: {
        notAType: '« {name} » n’est pas quelque chose que cette version sache lire comme un type.',
        listsDoNotMatch: 'Les deux listes ne contiennent pas la même chose. {inner}',
        cannotConnect: '{from} ne peut pas être relié à {to}.',
        unknownType:
          '« {name} » n’est pas un type connu de ce moteur. Le composant demande peut-être une version plus récente.',
        siblings:
          '{from} et {to} sont deux sortes de {shared}, mais l’un n’est pas l’autre. Passez par {shared} si c’est ce que vous vouliez dire.',
        noConversion: '{from} ne peut pas devenir {to}. Aucune conversion n’existe entre les deux.',
      },
    },
    empty: {
      heading: 'Votre canevas est vide',
      body: 'Un flux de travail est un petit nombre de composants reliés entre eux. Choisissez-en un à gauche pour placer votre première étape, reliez sa sortie à la suivante, puis appuyez sur Exécuter.',
      hint: 'Chaque composant indique ce qu’il peut atteindre avant de s’exécuter, et rien ne touche vos fichiers tant que vous ne l’avez pas autorisé.',
    },
    // The menu a right-click opens on the canvas. Removing a step was always possible from
    // the keyboard; this is where somebody finds out that it is.
    menu: {
      label: 'Actions du canevas',
      duplicate: 'Dupliquer',
      disable: 'Désactiver',
      enable: 'Activer',
      deleteStep: 'Supprimer l’étape',
      deleteConnection: 'Supprimer la connexion',
      paste: 'Coller',
      selectAll: 'Tout sélectionner',
    },
    keysHint:
      'Utilisez les flèches pour vous déplacer entre les étapes, Entrée pour ouvrir une étape dans l’inspecteur, Échap pour désélectionner, et Suppr pour retirer l’étape sélectionnée.',
    a11y: {
      selected: '{name}, étape {index} sur {total}, sélectionnée.',
    },
    node: {
      notInstalled: 'Non installé.',
    },
    wire: {
      ops: {
        toText: 'en texte',
        intToFloat: 'en décimal',
        boolToInt: 'en nombre',
        intToBool: 'en oui/non',
        round: 'arrondi',
        parseInt: 'analyser en nombre',
        parseFloat: 'analyser en décimal',
        parseBool: 'analyser en oui/non',
        parseJson: 'analyser le JSON',
        stringifyJson: 'en texte',
        encodeJson: 'en JSON',
        decodeJson: 'depuis JSON',
        readBytes: 'lire',
        writeTemp: 'vers un fichier',
        unwrapOption: 'peut être absent',
        map: 'chacun',
      },
    },
  },

  publish: {
    heading: 'Préparer une publication',
    intro:
      'Encastra lit le projet enregistré comme le lirait la personne qui le reçoit, puis l’écrit dans un dossier de votre choix, avec le document qui l’accompagnerait. Rien n’est envoyé : il n’existe aucun registre où l’envoyer, ni compte avec lequel l’envoyer.',
    saveFirst:
      'Enregistrez d’abord le projet. Ce qui est publié, c’est le fichier, et il n’existe pas encore.',
    saveChangesFirst:
      'Enregistrez d’abord vos modifications. Ce qui est publié, c’est le fichier sur le disque, et il ne correspond plus au canevas.',
    sections: {
      about: 'Ce que c’est',
      check: 'Ce qu’Encastra a trouvé',
      done: 'Où cela a été écrit',
    },
    fields: {
      title: {
        label: 'Nom',
        hint: 'Le nom affiché sur la page où quelqu’un décide.',
      },
      summary: {
        label: 'Résumé',
        hint: 'Une ou deux phrases : ce que cela fait, et pour qui.',
      },
      namespace: {
        label: 'Votre espace de noms',
        hint: 'Un nom de domaine inversé que vous contrôlez, comme dev.votrenom. Personne ne l’a vérifié — il n’y a pas de comptes —, c’est donc une affirmation, pas une preuve.',
      },
      version: {
        label: 'Version',
        hint: 'Numérotée comme 1.0.0. Une version publiée ne change jamais ; un changement reçoit un nouveau numéro.',
      },
      kind: {
        label: 'Type',
        hint: 'Un projet est fait pour être exécuté. Un modèle est fait pour être démonté et modifié.',
      },
      licence: {
        label: 'Licence',
        hint: 'Ce que quelqu’un d’autre peut en faire. Une partie dont la licence entre en conflit avec celle-ci est refusée.',
      },
    },
    kinds: {
      project: 'Projet',
      template: 'Modèle',
    },
    licences: {
      mit: 'MIT',
      'apache-2.0': 'Apache-2.0',
      'gpl-3.0-only': 'GPL-3.0-only',
      proprietary: 'Tous droits réservés',
    },
    derivedName: 'Il serait connu sous',
    freeOnly:
      'Gratuit, et seulement gratuit. Il n’y a ni prestataire de paiement ni compte à débiter : un prix ici serait un nombre que rien ne pourrait encaisser.',
    checking: 'Lecture du projet…',
    checkAgain: 'Vérifier à nouveau',
    prepare: 'Préparer…',
    nothingFound: 'Rien ici n’empêcherait de le publier.',
    notAnAudit:
      'Ceci trouve les erreurs assez mécaniques pour être trouvées. Ce n’est pas un audit de sécurité, et personne n’en a fait.',
    capabilities: {
      none: 'Il ne demande rien en dehors de lui-même.',
      some: 'La personne qui l’installe est interrogée, à chaque exécution, avant qu’il puisse utiliser :',
    },
    preparedInto: 'Le projet et son document de publication sont ici :',
    nowhereToSend: 'Ils restent sur cette machine. Il n’y a encore nulle part où les envoyer.',
    problems: {
      namespaceMissing: 'Une publication a besoin d’un espace de noms.',
      namespaceShape: 'Un espace de noms est un domaine inversé, comme dev.votrenom.',
      titleMissing: 'Une publication a besoin d’un nom.',
      titleUnusable: 'Ce nom ne contient ni lettre ni chiffre pour construire un identifiant.',
      summaryMissing: 'Une publication a besoin d’un résumé.',
      summaryShort: 'Quelques mots ne disent rien à qui doit décider. Dites ce que cela fait.',
      versionShape: 'Une version se numérote comme 1.0.0.',
    },
  },
  library: {
    heading: 'Votre bibliothèque',
    intro:
      'Tout ce que vous avez : les projets que vous avez créés, ce que vous avez reçu de quelqu’un d’autre, et les dossiers que vous avez préparés pour les transmettre. Tout reste sur cette machine. Rien n’est synchronisé, envoyé ni partagé.',
    import: 'Importer…',
    importTitle: 'Lire un dossier de publication qu’on vous a remis',
    importUnavailable: 'Nécessite l’application de bureau',
    search: {
      placeholder: 'Rechercher',
      ariaLabel: 'Rechercher dans votre bibliothèque',
    },
    sort: {
      label: 'Ordre',
      name: 'Par nom',
      recent: 'Plus récent',
      origin: 'Par provenance',
    },
    noMatches: 'Rien ici ne correspond.',
    quarantined:
      'La liste précédente n’a pas pu être lue : elle a été mise de côté sous le nom {name} et une nouvelle a été commencée. Rien n’a été supprimé et aucun de vos projets n’a été touché.',
    origin: {
      created: 'Créé ici',
      imported: 'Importé',
      prepared: 'Préparé',
    },
    status: {
      missing: {
        label: 'Absent',
        detail:
          'Il n’y a plus rien à l’endroit indiqué. Le fichier a été déplacé ou supprimé en dehors d’Encastra, ce qui est votre droit : cette ligne est périmée, pas fausse.',
      },
      changed: {
        label: 'Modifié',
        detail:
          'Le fichier est là, mais son contenu diffère de la dernière fois qu’Encastra l’a lu. Quelque chose l’a modifié ailleurs.',
      },
    },
    facts: {
      version: 'Version',
      publisher: 'Éditeur',
      steps: 'Étapes',
      when: 'Dernière fois',
    },
    row: {
      opened: 'Ouvert le {when}',
      added: 'Ajouté le {when}',
      publisherClaim:
        '{publisher} — revendiqué, non vérifié. Il n’y a pas de comptes, donc personne ne l’a contrôlé.',
      steps: {
        one: '{count} étape',
        other: '{count} étapes',
      },
    },
    reach: {
      none: 'Il ne demande rien en dehors de lui-même.',
      someLabel: 'Il demandera à atteindre :',
      asksEveryRun: 'L’avoir ici n’accorde rien de tout cela. Chaque exécution le demande.',
    },
    actions: {
      open: 'Ouvrir',
      remove: 'Retirer…',
    },
    remove: {
      cancel: 'Garder',
      keepsFile:
        'Cela le retire de la liste, rien de plus. Votre fichier reste exactement où vous l’avez mis.',
      forget: 'Le retirer de la liste',
      importedNote:
        'Cette copie a été faite par Encastra, qui peut donc la supprimer. À vous de choisir : la copie part, ou elle reste.',
      andDeleteCopy: 'Retirer et supprimer la copie',
      keepCopy: 'Retirer, garder la copie',
      refused:
        'Ce fichier est le vôtre, et il reste où il est. Encastra ne supprime que les copies qu’elle a faites elle-même.',
    },
    empty: {
      heading: 'Rien ici pour l’instant',
      body: 'Trois choses arrivent sur cette liste, et chacune commence par quelque chose que vous faites.',
      ways: {
        created: 'Un projet que vous enregistrez y est ajouté.',
        imported:
          'Un dossier de publication qu’on vous a remis y est ajouté quand vous l’importez, après qu’Encastra l’a lu et que vous avez dit oui.',
        prepared:
          'Un dossier que vous préparez pour le transmettre y est ajouté au moment où vous le préparez.',
      },
      build: 'Construire quelque chose',
      buildTitle: 'Ouvrir le constructeur et partir d’une toile vide',
    },
  },

  import: {
    heading: 'Recevoir une publication',
    intro:
      'Encastra a lu le dossier que vous avez choisi comme doit le lire celui qui le reçoit : il a vérifié le fichier face au document qui l’accompagne et a refait ici le contrôle de l’éditeur. Rien n’a été écrit, rien n’a été exécuté.',
    reading: 'Lecture du dossier…',
    confirm: 'Importer',
    nothing: 'rien',
    copiesNothingRuns:
      'Importer copie les fichiers dans votre bibliothèque. Rien ne s’exécute tant que vous ne l’ouvrez pas et n’appuyez pas sur Exécuter.',
    nothingWasTakenIn: 'Rien n’a été récupéré et rien n’a été modifié sur cette machine.',
    sections: {
      what: 'Ce qu’elle dit être',
      integrity: 'Si le fichier est bien celui décrit',
      inside: 'Ce qu’il y a dedans',
      asks: 'Ce qu’elle demanderait',
      check: 'Ce qu’Encastra a trouvé',
    },
    facts: {
      publisher: 'Éditeur',
      name: 'Connue sous',
      version: 'Version',
      kind: 'Type',
      licence: 'Licence',
      size: 'Taille',
      kilobytes: '{size} ko',
      runtime: 'Fonctionne sur',
      projectName: 'Projet',
      steps: 'Étapes',
      stepCount: {
        one: '{count} étape',
        other: '{count} étapes',
      },
      switchedOff: ' ({count} désactivées)',
      versions: 'Versions conservées',
      versionCount: {
        one: '{count} version',
        other: '{count} versions',
      },
    },
    kinds: {
      project: 'Projet',
      template: 'Modèle',
      component: 'Composant',
    },
    notVerified:
      'Personne n’a vérifié que cet éditeur est bien celui que le nom indique. Il n’y a pas de comptes, donc personne n’aurait pu le faire.',
    checksumMatches:
      'Le fichier correspond à la somme de contrôle inscrite dans le document qui l’accompagne.',
    checksumIsNotProvenance:
      'Cela prouve que le fichier n’a pas été altéré depuis sa préparation. Cela ne dit rien sur qui l’a préparé.',
    capabilities: {
      none: 'Il ne demande rien en dehors de lui-même.',
      some: 'À l’exécution, il demandera à utiliser :',
      grantsNothing:
        'Importer n’accorde rien de tout cela. Chaque exécution demande avant d’atteindre quoi que ce soit.',
    },
    nothingFound: 'Rien ici n’empêche de le récupérer.',
    notAnAudit:
      'Ceci trouve les erreurs assez mécaniques pour être trouvées. Ce n’est pas un audit de sécurité, et personne n’en a fait.',
    disagreement: {
      declared: 'Le document dit',
      actual: 'Le projet demande',
    },
    tokens: {
      title: 'titre',
      summary: 'résumé',
      changelog: 'journal des modifications',
      publisher: 'éditeur',
      categories: 'catégories',
      tags: 'mots-clés',
      runtime: 'moteur d’exécution',
    },
    errors: {
      notAFolder:
        'Ce n’est pas un dossier. Une publication est un dossier contenant un projet et le document qui le décrit.',
      folderIsALink:
        'Ce dossier est un lien vers un autre endroit. Encastra ne le suit pas, sinon ce qu’il lirait et ce que vous avez choisi ne seraient pas la même chose. Choisissez le dossier lui-même.',
      folderNotChosen:
        "Ce dossier n'a pas été choisi pendant cette session. Sélectionnez-le avec le sélecteur de dossiers, pour que ce qu'Encastra lit soit bien ce que vous avez désigné.",
      noDocument:
        'Il n’y a pas de publication.json dans ce dossier : rien n’y dit ce que c’est. C’est un dossier de fichiers, pas une publication.',
      documentIsALink:
        'publication.json est un lien vers un autre fichier, pas un fichier. Encastra lit ce qui se trouve dans le dossier que vous avez choisi, et rien en dehors.',
      documentTooLarge:
        'publication.json fait environ {size} ko, et cette version en lit au plus {max} ko. Un document de publication tient sur une page ; un fichier de cette taille n’en est pas un.',
      documentUnreadable:
        'publication.json n’a pas pu être lu : {reason}. Demandez à la personne qui l’a préparé de le refaire.',
      noProject:
        'Il n’y a aucun fichier .encastra dans ce dossier. Une publication, c’est un projet et le document qui le décrit.',
      moreThanOneProject:
        'Une publication, c’est un seul projet, et ce dossier en contient {count} : {names}. La personne qui l’a préparé devrait envoyer un dossier par projet.',
      projectIsALink:
        'Le fichier du projet est un lien vers un autre fichier, pas un fichier. Encastra installe ce qui se trouve dans le dossier que vous avez choisi, et rien en dehors.',
      unexpectedEntries:
        'Un dossier de publication contient un document et un projet, et rien d’autre. Celui-ci contient aussi {names}. Encastra ne récupère pas un dossier dont il ne peut rendre compte.',
      tooManyEntries:
        "Un dossier de publication contient un document et un projet, et rien d'autre. Celui-ci contient plus de {max} entrées, ce qui n'est pas une publication, quelles qu'elles soient.",
      projectTooLarge:
        'Le projet fait environ {size} ko, et cette version en installe au plus {max} ko.',
      checksumMismatch:
        'Le fichier du projet n’est pas celui que décrit cette publication. Soit le document décrit un autre fichier, soit le fichier a changé en chemin. Redemandez-le.',
      projectUnreadable:
        'Le fichier du projet n’a pas pu être lu : {reason}. Il a peut-être été créé par une version plus récente d’Encastra, ou abîmé en chemin.',
      notInstallable:
        'Cette version ne sait pas installer un {publicationKind}, et ne fera pas semblant.',
      notAListingId:
        '« {id} » n’est pas un nom de publication : il n’y a donc pas de nom sûr sous lequel le classer.',
      notAVersion:
        '« {version} » n’est pas une version. Les publications sont numérotées comme 1.2.0.',
      notPublishersNamespace:
        '« {listing} » n’est pas dans l’espace de noms de {publisher}. Le document nomme un éditeur et une publication qui appartient à un autre, et Encastra ne peut pas savoir laquelle des deux est l’erreur.',
      textTooLong:
        'Le champ {field} est plus long que ce que cette version lit (au plus {max} caractères).',
      textHasControlCharacters:
        'Le champ {field} contient des caractères capables de masquer ce qu’il dit vraiment — de ceux qui font passer un nom pour un autre. Encastra le refuse plutôt que de réécrire en silence ce que quelqu’un a écrit.',
      documentDisagreesWithProject:
        'Le document et le projet ne s’accordent pas sur le {about}. La page qui décrit ceci décrit autre chose que le fichier qui l’accompagne.',
      runtimeIncompatible:
        'Cette publication vise un moteur {requires}, et celui-ci est {have}. Rien n’est installé pour une version pour laquelle ce n’a pas été conçu.',
      reviewRefused:
        'Le même contrôle que son éditeur a passé le refuse ici. Ceci devrait changer avant que quiconque puisse le récupérer :',
      capabilitiesDisagree:
        'Le document et le projet ne s’accordent pas sur ce que ceci demande. Sous-déclarer les permissions est le problème évident ; les sur-déclarer apprend aux gens à survoler la liste, ce qui est le problème plus subtil. Les deux sont refusés.',
      alreadyImported:
        '{listing} {version} est déjà dans votre bibliothèque. Une version publiée ne change jamais : il n’y a donc rien de nouveau à récupérer.',
      io: 'Quelque chose sur cet ordinateur a refusé l’opération ({reason}). Rien n’a été récupéré.',
      unknown:
        'Encastra a refusé ce dossier pour une raison que cette version ne sait pas formuler. Il n’a pas été récupéré.',
    },
  },

  toolbar: {
    publish: 'Publier',
    publishTitle: 'Préparer ce projet pour que quelqu’un d’autre l’installe',
    preview: {
      badge: 'aperçu',
      title: 'Aucun moteur d’exécution n’est rattaché à cette fenêtre.',
    },
    new: 'Nouveau',
    open: 'Ouvrir',
    save: 'Enregistrer',
    unsavedChanges: 'Modifications non enregistrées',
    check: 'Vérifier',
    stop: 'Arrêter',
    run: 'Exécuter',
    startWatching: 'Commencer à surveiller',
    watching: 'Surveillance en cours',
    recordedRuns: {
      everythingAllowed: 'Enregistré : tout autorisé',
      folderNotAllowed: 'Enregistré : le dossier n’a pas été autorisé',
    },
    notifications: {
      more: '{count} de plus',
    },
    status: {
      steps: {
        one: '{count} étape',
        other: '{count} étapes',
      },
      running: 'en cours',
      runs: {
        one: '{count} exécution',
        other: '{count} exécutions',
      },
      waiting: '{count} en attente',
      ok: {
        one: '{count} réussie',
        other: '{count} réussies',
      },
      failed: {
        one: '{count} échouée',
        other: '{count} échouées',
      },
      skipped: {
        one: '{count} ignorée',
        other: '{count} ignorées',
      },
    },
  },

  components: {
    header: {
      title: 'Composants',
      summary: '{count} installés.',
      summaryWithTriggers:
        '{count} installés — {triggerCount} d’entre eux démarrent un flux de travail par eux-mêmes ; le reste s’exécute comme une étape à l’intérieur d’un autre.',
      note: 'Tout ceci est fourni avec l’application ; en installer d’autres nécessite le bac à sable pour le code tiers, qui n’est pas encore construit.',
    },
    search: {
      placeholder: 'Rechercher',
      ariaLabel: 'Rechercher des composants',
    },
    filters: {
      categoryLegend: 'Catégorie',
    },
    empty: 'Rien ne correspond à cela.',
    card: {
      triggerBadge: 'démarre un flux de travail',
      triggerNote:
        'Une source d’événements, pas une étape — ceci démarre une exécution au lieu de s’exécuter à l’intérieur d’une autre.',
      noDescription: 'Ce composant n’a pas documenté ce qu’il fait.',
      takes: 'Prend',
      gives: 'Donne',
      addToCanvas: 'Ajouter au canevas',
    },
    reach: {
      label: 'Peut atteindre',
      none: 'N’atteint rien en dehors de ce flux de travail',
      verb: {
        fsRead: 'Lit des fichiers',
        fsWrite: 'Écrit des fichiers',
        netHttp: 'Utilise le réseau',
        systemClipboard: 'Utilise le presse-papiers',
        systemNotify: 'Affiche des notifications',
      },
      cannot: {
        fsRead: 'lire vos fichiers',
        fsWrite: 'écrire des fichiers',
        netHttp: 'utiliser le réseau',
        systemClipboard: 'utiliser le presse-papiers',
        systemNotify: 'afficher des notifications',
      },
    },
  },

  security: {
    title: 'Sécurité',
    intro:
      'Les composants ne peuvent pas accéder à vos fichiers, à votre réseau ou à votre presse-papiers, sauf si un manifeste le déclare et que vous l’autorisez. Les permissions sont accordées par exécution, et chaque demande — autorisée ou refusée — est enregistrée là où vous pouvez la consulter.',
    installed: {
      title: 'Composants installés',
      headers: {
        component: 'Composant',
        version: 'Version',
        origin: 'Origine',
        canReach: 'Peut atteindre',
      },
      builtIn: 'intégré',
      nothing: 'rien',
      thirdPartyNote:
        'Rien ici ne vient de l’extérieur de cette application. Les composants tiers s’exécuteraient dans un bac à sable WebAssembly sans autorité ambiante ; ce bac à sable est conçu et documenté, mais {notBuilt}, donc les installer n’est pas encore possible.',
      thirdPartyNoteEmphasis: 'pas construit',
    },
    grants: {
      title: 'Autorisé dans le flux de travail ouvert',
      empty:
        'Rien n’a été autorisé. Un flux de travail qui a besoin d’un dossier le demandera avant de s’exécuter.',
      note: 'Cela ne dure que pour cette session. Fermer l’application les oublie, donc un flux de travail que vous n’avez pas consulté depuis un mois ne peut pas continuer à écrire quelque part.',
    },
    privacy: {
      title: 'Confidentialité',
      telemetry: { label: 'Télémétrie', value: 'Aucune. Rien n’est collecté ni envoyé.' },
      crashReports: { label: 'Rapports de plantage', value: 'Aucun.' },
      accounts: { label: 'Comptes', value: 'Aucun. Il n’y a ni connexion ni serveur.' },
      yourFiles: {
        label: 'Vos fichiers',
        value:
          'Ne quittent jamais cette machine, sauf si un flux de travail que vous avez créé les envoie quelque part.',
      },
      runJournals: {
        value:
          'Enregistrent des tailles et des formes, jamais le contenu des fichiers. Un journal est conservé en mémoire tant que la fenêtre est ouverte et affichée ; rien n’est écrit sur le disque, et fermer l’application le supprime.',
      },
    },
    limits: {
      title: 'Contre quoi cela ne protège pas',
      misuse:
        'Un composant auquel vous accordez un large accès peut en abuser. La boîte de dialogue peut rendre cela informé ; elle ne peut pas le rendre impossible.',
      trustedBase:
        'Les composants intégrés s’exécutent comme du code natif ordinaire. Ils sont contraints par le courtier de permissions, mais un bug dans l’un d’eux est un bug dans la base de confiance.',
      noAudit:
        'Cette version n’a fait l’objet d’aucun audit de sécurité externe. C’est un prérequis pour distribuer des composants écrits par d’autres personnes, pas pour exécuter vos propres flux de travail.',
      unsigned:
        'Rien ici n’est encore signé, donc cette version ne peut pas prouver qu’elle n’a pas été altérée.',
      previewOnly: 'Ceci est un aperçu dans le navigateur, sans aucun moteur d’exécution rattaché.',
    },
    footer:
      'Moteur {runtime} · schéma de protocole {protocolSchema} · schéma de projet {projectSchema}',
  },

  inspector: {
    problemsTitle: 'Problèmes',
    projectTitle: 'Projet',
    selectStep:
      'Sélectionnez une étape pour la configurer, ou choisissez un composant pour commencer.',
    component: 'Composant',
    switchOn: 'Activer',
    switchOff: 'Désactiver',
    settingsTitle: 'Réglages',
    nothingChosen: 'Rien de choisi',
    entryInputs: {
      title: 'Matériau de départ',
      doc: 'Rien dans le graphe ne produit cela, donc l’exécution en a besoin de votre part.',
    },
    permissions: {
      title: 'Permissions',
      none: 'Ce composant ne demande rien. Il ne travaille qu’avec ce que le graphe lui fournit, et ne peut accéder ni à vos fichiers, ni au réseau, ni au presse-papiers.',
      allowed: 'Autorisé',
      allowFolder: 'Autoriser ce dossier',
      allowHost: 'Autoriser {host}',
      allowAddress: 'Autoriser cette adresse',
      allow: 'Autoriser',
      scope:
        'Autorisé tant que ce projet est ouvert. Chaque exécution utilise exactement ce dossier ou cette adresse, et fermer le projet ou en changer l’oublie.',
      chooseFolderFirst: 'Choisissez d’abord un dossier.',
      enterAddressFirst: 'Saisissez d’abord une adresse.',
      notASetting:
        'Ce n’est pas un réglage — le composant ne l’a jamais déclaré, donc le moteur le refuse quoi que vous autorisiez ici.',
    },
    versions: {
      title: 'Versions',
      titleWithCount: 'Versions · {count}',
      empty:
        'Enregistrez ce projet pour commencer à conserver des versions. Chaque enregistrement en garde une, et rien n’est jamais écrasé.',
      currentVersionTitle: 'Ceci est la version actuelle.',
      restoreTitle:
        'Restaurer celle-ci. Elle est ajoutée comme une nouvelle version ; rien n’est perdu.',
      current: 'Actuelle',
      versionNumber: 'Version {number}',
      restore: 'Restaurer',
    },
    runRecord: {
      title: 'Dernière exécution',
      code: 'Code : {code}',
      neverRan: 'Cette étape ne s’est jamais exécutée, car {name} ne s’est pas terminée.',
      status: 'État',
      took: 'Durée',
      in: 'entrée {port}',
      out: 'sortie {port}',
      permissionsUsed: 'Permissions utilisées',
      refused: ' · {count} refusées',
      logs: 'Journaux',
    },
  },

  runPanel: {
    ariaLabel: 'Exécution',
    title: 'Exécution',
    recordingTitle:
      'Ceci est une exécution enregistrée, rejouée pour le débogueur. Elle ne vient pas de se produire sur cette machine.',
    empty:
      'Rien ne s’est encore exécuté. Appuyez sur Exécuter ci-dessus et chaque étape apparaîtra ici, dans l’ordre où le moteur les exécute, avec son état et sa durée — ou, en cas d’échec, ce qui s’est mal passé et quoi faire.',
    status: {
      pending: 'En attente',
      running: 'En cours',
      ok: 'Terminée',
      failed: 'Échouée',
      skipped: 'Ignorée',
      cancelled: 'Annulée',
      disabled: 'Désactivée',
    },
    outcome: {
      watching: 'Surveillance des changements…',
      running: 'Exécution…',
      finished: 'Terminé.',
      finishedIn: 'Terminé en {took}.',
      partial: {
        one: '{count} étape a échoué. Le reste du graphe s’est tout de même exécuté.',
        other: '{count} étapes ont échoué. Le reste du graphe s’est tout de même exécuté.',
      },
      failed: 'Rien ne s’est terminé.',
      cancelled: 'Arrêté.',
    },
    watch: {
      runsSoFar: {
        one: '{count} exécution jusqu’ici',
        other: '{count} exécutions jusqu’ici',
      },
      pendingWaiting: '{count} en attente',
    },
    step: {
      neverRan: 'Jamais exécutée — {name} ne s’est pas terminée.',
    },
  },

  onboarding: {
    tour: {
      stepCount: 'Étape {current} sur {total}',
      done: 'Terminé — continuez quand vous êtes prêt.',
      waiting: 'En attente que vous essayiez.',
      finish: 'Terminer',
      next: 'Suivant',
      canvas: {
        title: 'Voici votre canevas',
        body: 'Un flux de travail est composé de quelques composants reliés entre eux. Tout s’exécute sur cette machine, et rien n’accède à vos fichiers tant que vous ne l’avez pas autorisé.',
      },
      addFirst: {
        title: 'Ajoutez la première étape',
        body: 'À gauche se trouve chaque composant installé. Trouvez Surveiller un dossier et ajoutez-le — il démarre le flux de travail dès qu’un fichier apparaît là où vous le choisissez.',
      },
      addSecond: {
        title: 'Ajoutez quelque chose à faire',
        body: 'Ajoutez maintenant Redimensionner l’image. Il prend une image et en fait une copie plus petite, sans toucher à l’originale.',
      },
      connect: {
        title: 'Reliez-les entre elles',
        body: 'Faites glisser depuis le port de fichier de Surveiller un dossier jusqu’au port d’image de Redimensionner l’image. Un fichier n’est pas encore une image, donc l’éditeur insère l’étape qui l’ouvre — et refuse carrément la liaison si les deux ne pouvaient jamais correspondre.',
      },
      configure: {
        title: 'Indiquez-lui quel dossier',
        body: 'Sélectionnez une étape pour la configurer à droite. Surveiller un dossier a besoin de savoir quel dossier surveiller, et Enregistrer un fichier a besoin de savoir où mettre le résultat.',
      },
      allow: {
        title: 'Autorisez-lui ce dossier',
        body: 'Un composant ne peut toucher à rien tant que vous ne le lui dites pas, et une permission est limitée au seul dossier que vous choisissez. Appuyez sur Autoriser sur l’étape qui l’a demandé.',
      },
      run: {
        title: 'Exécutez-le',
        body: 'Appuyez sur Exécuter, ou Ctrl+Entrée. Chaque étape s’allume au fur et à mesure, et le panneau ci-dessous enregistre ce qu’elle a fait et combien de temps cela a pris.',
      },
    },
    welcome: {
      title: 'Bienvenue dans Encastra',
      lead: 'Construisez des logiciels en assemblant des composants. Vous choisissez les pièces, vous les reliez, puis vous appuyez sur exécuter — sur cette machine, sans que rien n’accède à vos fichiers tant que vous ne l’avez pas autorisé.',
      createFirst: {
        title: 'Créez votre premier flux de travail',
        note: 'Un court parcours guidé, environ une minute',
      },
      exploreSample: {
        title: 'Explorez un exemple',
        note: '{name}, déjà construit — vous choisissez ses dossiers',
      },
      skip: {
        title: 'Ignorer',
        note: 'Allez-y directement. C’est dans Réglages si vous le voulez plus tard.',
      },
    },
  },

  // La seule question que pose cette application avant d’abandonner du travail.
  unsaved: {
    title: 'Modifications non enregistrées',
    reasons: {
      new: 'Vous avez des modifications non enregistrées. Commencer un nouveau projet les perdrait.',
      open: 'Vous avez des modifications non enregistrées. Ouvrir un autre projet les perdrait.',
      demo: 'Vous avez des modifications non enregistrées. Charger un exemple les perdrait.',
      restore:
        'Vous avez des modifications non enregistrées. Restaurer une version antérieure les perdrait.',
      close: 'Vous avez des modifications non enregistrées. Fermer Encastra les perdrait.',
      'library-open':
        'Vous avez des modifications non enregistrées. Ouvrir un élément de votre bibliothèque les perdrait.',
    },
    save: 'Enregistrer et continuer',
    discard: 'Abandonner les modifications',
    cancel: 'Annuler',
  },
  messages: {
    untitledProject: 'Sans titre',
    recordingNote: 'Ceci est un enregistrement, pas une exécution sur cette machine.',
    problemsToFix: {
      one: '{count} problème à résoudre.',
      other: '{count} problèmes à résoudre.',
    },
    readyToRun: 'Ce graphe est prêt à être exécuté.',
    nothingRanProblems: {
      one: 'Rien ne s’est exécuté : {count} problème à résoudre d’abord.',
      other: 'Rien ne s’est exécuté : {count} problèmes à résoudre d’abord.',
    },
    saved: {
      one: 'Enregistré. {count} version conservée.',
      other: 'Enregistré. {count} versions conservées.',
    },
    watchingChanges: 'Surveillance en cours. Cela s’exécutera dès que quelque chose apparaît.',
    running: 'En cours d’exécution.',
    stopping: 'Arrêt en cours.',
    demoLoaded: '{name} : renseignez {needs}, puis démarrez-le.',
    restored: 'Restauré. La version depuis laquelle vous veniez est toujours dans l’historique.',
    missingComponents: 'Ce projet a besoin de {missing}, qui n’est pas installé.',
    runtimeSilent: 'Quelque chose dans le moteur n’a pas répondu.',
    libraryMissing:
      '{name} n’est plus là où il était. Remettez-le en place, ou ouvrez-le depuis l’endroit où il se trouve maintenant.',
    imported: '{name} récupéré. Rien ne s’est exécuté.',
    removedFromLibrary: '{name} ne figure plus dans la liste. Le fichier est resté où il était.',
    removedAndDeleted:
      '{name} ne figure plus dans la liste, et la copie faite par Encastra a été supprimée.',
  },

  demos: {
    imageProcessor: {
      name: 'Processeur d’images',
      summary:
        'Surveille un dossier. Dès qu’une image apparaît, il en fait une copie plus petite dans un autre dossier.',
      needs: {
        watch: 'Un dossier à surveiller',
        save: 'Un dossier où enregistrer',
      },
    },
    fileOrganiser: {
      name: 'Organisateur de fichiers',
      summary:
        'Surveille un dossier et déplace ce qui y arrive vers l’un de trois autres, selon le type de fichier.',
      needs: {
        watch: 'Un dossier à surveiller',
        images: 'Un dossier pour les images',
        documents: 'Un dossier pour les documents',
      },
    },
    thumbnails: {
      name: 'Miniatures',
      summary:
        'Transforme un dossier d’images en aperçus carrés, prêts pour une galerie ou une grille.',
      needs: {
        watch: 'Un dossier à surveiller',
        save: 'Un dossier où enregistrer',
      },
    },
  },

  settings: {
    eyebrow: 'Réglages',
    nav: {
      ariaLabel: 'Catégories de réglages',
    },
    categories: {
      general: {
        label: 'Général',
        description: 'Prise en main, et ce que cette application affiche à l’ouverture.',
      },
      appearance: {
        label: 'Apparence',
        description: 'Thème et mouvement.',
      },
      language: {
        label: 'Langue et région',
        description:
          'La langue que parle cette interface, et comment elle affiche les dates et les nombres.',
      },
      workspace: {
        label: 'Espace de travail',
        description: 'Où vivent vos projets sur le disque.',
      },
      projects: {
        label: 'Projets',
        description: 'Comment un projet s’ouvre, et le format dans lequel il est enregistré.',
      },
      editor: {
        label: 'Éditeur',
        description: 'Raccourcis et comportement pendant la construction d’un graphe.',
      },
      canvas: {
        label: 'Canevas',
        description:
          'Aides dessinées sur le canevas lui-même : la grille, l’alignement, la mini-carte.',
      },
      runtime: {
        label: 'Exécution',
        description: 'Ce qui s’affiche à l’écran pendant l’exécution d’un flux de travail.',
      },
      components: {
        label: 'Composants',
        description:
          'Ce qui est installé dans cette version, et exactement ce que chacun peut atteindre.',
      },
      security: {
        label: 'Sécurité',
        description:
          'Le modèle de permissions, en résumé. Le détail complet vit sur son propre écran.',
      },
      privacy: {
        label: 'Confidentialité',
        description: 'Ce que cette application collecte et envoie, énoncé comme un fait.',
      },
      notifications: {
        label: 'Notifications',
        description:
          'Où apparaissent les notifications d’un flux de travail, et où elles n’apparaissent pas.',
      },
      files: {
        label: 'Fichiers',
        description: 'Ce qu’Encastra écrit sur le disque, et ce qu’il n’écrit pas.',
      },
      updates: {
        label: 'Mises à jour',
        description: 'Comment une version plus récente arrive sur cette machine.',
      },
      account: {
        label: 'Compte',
        description: 'Connexion, abonnements, et pourquoi il n’y en a aucun.',
      },
      developer: {
        label: 'Développeur',
        description:
          'Les détails internes pour qui les veut, et un moyen de revenir aux valeurs par défaut.',
      },
      diagnostics: {
        label: 'Diagnostic',
        description:
          'Ce que rapportent cette version et cette machine, prêt à coller dans un rapport de bug.',
      },
      about: {
        label: 'À propos',
        description: 'Version, compilation, et où vit la documentation complète.',
      },
    },

    shared: {
      startup: {
        label: 'Au démarrage',
        hint: 'Ce que cette application affiche à l’ouverture.',
        options: {
          home: 'Accueil',
          lastProject: 'Dernier projet',
        },
      },
      runtimeStatus: {
        label: 'Exécution',
        hint: 'Si un véritable moteur Encastra est rattaché à cette fenêtre.',
        attached: 'Rattaché',
        notAttached: 'Non rattaché — aperçu dans le navigateur',
      },
      signing: {
        label: 'Signature',
        hint: 'Si cette version peut prouver qui l’a produite.',
        status: 'Non signée',
      },
      version: {
        label: 'Version',
        hint: 'La version que vous exécutez.',
        unknown: 'inconnue',
      },
      openSecurity: 'Ouvrir Sécurité',
      notBuilt: 'Pas encore construit',
      noneCollected: 'Rien de collecté',
      schemaValue: 'schéma {value}',
      projectFormatHint: 'Comment un fichier .encastra enregistré est écrit.',
    },

    general: {
      title: 'Prise en main',
      welcomeTour: {
        label: 'Visite de bienvenue',
        hint: 'Le premier flux de travail guidé, affiché une fois au premier lancement.',
        button: 'Réafficher la bienvenue',
      },
    },

    appearance: {
      title: 'Apparence',
      theme: {
        label: 'Thème',
        hint: 'Système suit votre système d’exploitation. Clair et sombre restent fixes quel qu’il soit.',
        options: {
          system: 'Système',
          light: 'Clair',
          dark: 'Sombre',
        },
      },
      motion: {
        label: 'Mouvement',
        hint: 'Réduit désactive entièrement les transitions plutôt que de les raccourcir, quelle que soit la préférence de votre système.',
        options: {
          system: 'Système',
          reduced: 'Réduit',
        },
      },
    },

    language: {
      interface: {
        title: 'Langue',
        picker: {
          label: 'Langue de l’interface',
          hint: 'Traduit cette application. L’anglais reste toujours la solution de repli pour ce qui n’est pas encore traduit dans la langue choisie.',
        },
        loading: 'Chargement…',
        loadError: 'Impossible de charger {name}. La langue actuelle est conservée.',
        comingLater: {
          label: 'À venir',
          hint: 'L’interface est structurée pour les prendre en charge ; personne ne les a encore traduites.',
        },
      },
      formatting: {
        title: 'Comment cette langue écrit les choses',
        dates: {
          label: 'Dates',
          hint: 'Aujourd’hui, dans l’ordre et les mots propres à cette langue.',
        },
        times: {
          label: 'Heures',
          hint: 'L’heure actuelle, selon la convention de cette langue.',
        },
        numbers: {
          label: 'Nombres',
          hint: 'Un nombre d’exemple, groupé comme le groupe cette langue.',
        },
        note: 'Chaque date, heure et nombre que cette application affiche suit la langue ci-dessus — il n’y a pas de format séparé à choisir, comme dans la plupart des logiciels bien faits.',
      },
    },

    workspace: {
      title: 'Démarrage',
      lastProject: {
        label: 'Dernier projet',
        hint: 'Enregistré automatiquement chaque fois que vous ouvrez ou enregistrez un projet. Utilisé quand Au démarrage est réglé sur Dernier projet — un projet déplacé ou supprimé depuis est simplement oublié plutôt qu’affiché comme une erreur.',
        none: 'Aucun pour l’instant',
      },
    },

    projects: {
      location: {
        title: 'D’où ils s’ouvrent',
        label: 'Dossier de projets par défaut',
        hint: 'Là où s’ouvre la boîte de dialogue d’enregistrement. Laissé vide, elle s’ouvre là où le système était pour la dernière fois.',
        placeholder: 'Aucun dossier par défaut défini',
        browse: 'Parcourir…',
        browseUnavailable: 'Nécessite le moteur de bureau, pas cet aperçu dans le navigateur',
      },
      format: {
        title: 'Format',
        label: 'Format du fichier de projet',
      },
      notBuilt: {
        title: 'Pas encore construit',
        copy: 'Il n’y a pas de liste de projets récents. Les réglages sont par machine plutôt que par projet — un projet ouvert sur une autre machine n’emporte pas ses propres préférences avec lui, seulement le graphe lui-même.',
      },
    },

    editor: {
      shortcuts: {
        title: 'Raccourcis clavier',
        table: {
          shortcut: 'Raccourci',
          action: 'Action',
        },
        actions: {
          runOrWatch:
            'Exécute le flux de travail, ou commence à surveiller s’il s’ouvre avec un déclencheur',
          save: 'Enregistrer',
          saveAs: 'Enregistrer sous',
          openProject: 'Ouvrir un projet',
          undo: 'Annuler',
          redo: 'Rétablir',
          copySelection: 'Copier la sélection',
          paste: 'Coller',
          duplicateSelection: 'Dupliquer la sélection',
          selectAll: 'Tout sélectionner',
          deleteSelection: 'Supprimer la sélection',
        },
        note: 'Fixes pour l’instant plutôt que réassignables. Aucun ne se déclenche pendant que vous tapez dans un champ de texte.',
      },
      notBuilt: {
        title: 'Pas encore construit',
        copy: 'L’enregistrement automatique, un intervalle d’enregistrement configurable et la personnalisation des raccourcis ci-dessus ne sont pas encore construits.',
      },
    },

    canvas: {
      title: 'Canevas',
      grid: {
        label: 'Grille',
        hint: 'Affiche la grille d’alignement derrière les nœuds sur le canevas.',
      },
      snapToGrid: {
        label: 'Aligner sur la grille',
        hint: 'Les nœuds se calent sur la grille pendant que vous les faites glisser, au lieu de rester libres.',
      },
      minimap: {
        label: 'Mini-carte',
        hint: 'Un petit aperçu de tout le graphe dans le coin du canevas.',
      },
    },

    runtime: {
      runs: {
        title: 'Exécutions',
        openRunPanel: {
          label: 'Ouvrir le panneau d’exécution',
          hint: 'Ramène automatiquement le panneau d’exécution au premier plan dès qu’une exécution démarre.',
          toggleLabel: 'Ouvrir le panneau d’exécution au démarrage d’une exécution',
        },
      },
      notBuilt: {
        title: 'Pas encore construit',
        copy: 'Exécuter les étapes en parallèle, les délais d’exécution, les limites de nouvelle tentative et les limites de ressources par exécution ne sont pas configurables. Un flux de travail exécute ses étapes dans l’ordre déterminé par la validation, jusqu’à la réussite ou l’échec, avec le temps et la mémoire que la machine lui accorde.',
      },
    },

    components: {
      installed: {
        title: 'Installés',
        components: {
          label: 'Composants',
          hint: 'Tout ce que cette version inclut de base, plutôt que téléchargé.',
          builtIn: '{count} inclus de base',
        },
        thirdParty: {
          label: 'Tiers',
          hint: 'Composants externes à cette application, exécutés dans un bac à sable sans autorité ambiante.',
          installed: '{count} installés',
          notBuilt: 'Le bac à sable n’est pas encore construit',
        },
        permissionTable: {
          label: 'Table complète des permissions',
          hint: 'Chaque composant installé, sa version, et exactement ce qu’il peut atteindre.',
        },
      },
      table: {
        title: 'Chaque composant, et ce qu’il peut atteindre',
        headers: {
          component: 'Composant',
          version: 'Version',
          source: 'Source',
          canReach: 'Peut atteindre',
        },
        kind: {
          core: 'inclus de base',
          thirdParty: 'tiers',
        },
        none: 'rien',
        note: 'Rien en dehors de cette liste n’est installé, et rien ici ne peut atteindre quoi que ce soit que sa propre ligne ne nomme pas — pas d’accès arbitraire aux fichiers, pas de shell, pas de réseau au-delà de ce qui est listé.',
      },
      capabilityLabels: {
        fsRead: 'Lire des fichiers',
        fsWrite: 'Écrire des fichiers',
        netHttp: 'Utiliser le réseau',
        systemNotify: 'Afficher des notifications',
        systemClipboard: 'Utiliser le presse-papiers',
      },
      installMore: {
        title: 'Installer davantage',
        installFromFile: {
          label: 'Installer depuis un fichier',
          hint: 'Ajouter un composant tiers à cette version.',
        },
        note: 'Le bac à sable où ces composants s’exécuteraient est conçu et documenté mais pas encore construit, donc rien en dehors des {count} listés ci-dessus ne peut être installé pour l’instant.',
      },
    },

    security: {
      title: 'Modèle de permissions',
      copy: 'Un composant ne peut pas accéder à vos fichiers, à votre réseau ou à votre presse-papiers, sauf si son manifeste le déclare et que vous l’autorisez — une fois par exécution. Chaque demande, autorisée ou refusée, est enregistrée là où vous pouvez la consulter.',
      thirdParty: {
        label: 'Composants tiers',
        hint: 'Si quelque chose en dehors de cette version peut être installé et exécuté.',
        status: 'Pas encore possible — le bac à sable n’est pas construit',
      },
      allowedInOpenWorkflow: {
        label: 'Autorisé dans le flux de travail ouvert',
        hint: 'Effacé dès que cette application se ferme.',
        nothingAllowed: 'Rien d’autorisé',
        allowed: '{count} autorisés',
      },
      fullDetail: {
        label: 'Détail complet',
        hint: 'Ce qui a été autorisé, à quoi, et ce que cela ne protège pas.',
      },
    },

    privacy: {
      collect: {
        title: 'Ce que cette application pourrait collecter, et ne collecte pas',
        telemetry: {
          label: 'Télémétrie',
          hint: 'Données d’usage — quelles fonctionnalités sont utilisées, et à quelle fréquence — envoyées à un serveur pour qu’une équipe puisse prioriser son travail.',
        },
        crashReports: {
          label: 'Rapports de plantage',
          hint: 'Une trace de pile et une version de build, envoyées automatiquement en cas de défaillance, pour qu’elle puisse être corrigée sans que vous ayez à la signaler vous-même.',
        },
        analytics: {
          label: 'Analytique d’usage',
          hint: 'Comptages de fonctionnalités, durée de session, ou toute autre chose qui transformerait votre usage de cette application en un chiffre sur le tableau de bord de quelqu’un d’autre.',
        },
        note: 'Ces trois éléments nécessiteraient un serveur auquel envoyer les données. Il n’y en a pas — un interrupteur « désactivé » ici impliquerait un mécanisme qui n’existe pas.',
      },
      account: {
        title: 'Compte',
        signIn: {
          label: 'Connexion',
          hint: 'Une identité liée à cette application, comme la plupart des logiciels dotés d’un serveur en demandent une.',
          status: 'Aucun — il n’y a pas de serveur auquel se connecter',
        },
      },
      yourData: {
        title: 'Vos données',
        projects: {
          label: 'Projets',
          hint: 'Conservés en fichiers .encastra là où vous les enregistrez. Pas de seconde copie cachée.',
          status: 'Restent sur cette machine',
        },
        runJournals: {
          label: 'Journaux d’exécution',
          hint: 'Enregistrent des tailles et des formes, jamais le contenu des fichiers. Conservés en mémoire tant que la fenêtre est ouverte.',
          status: 'Supprimés à la fermeture',
        },
      },
    },

    notifications: {
      window: {
        title: 'Dans cette fenêtre',
        toast: {
          label: 'Notifications',
          hint: 'Un flux de travail peut demander à en afficher une, en utilisant la même capacité system.notify que toute autre permission — déclarée dans son manifeste et autorisée avant qu’apparaisse quoi que ce soit.',
          shown: '{count} affichées durant cette session',
        },
        note: 'Jusqu’aux 20 plus récentes sont conservées tant que la fenêtre est ouverte ; les ignorer vide la liste. Fermer l’application les oublie, comme tout ce qui n’est pas un projet enregistré.',
      },
      notBuilt: {
        title: 'Pas encore construit',
        copy: 'Il n’y a pas de permission de notification du système d’exploitation, pas d’e-mail, et pas de notification push — rien ne vous atteint en dehors de cette fenêtre. Un historique des notifications passées au-delà de la session actuelle n’est pas non plus construit.',
      },
    },

    files: {
      disk: {
        title: 'Ce qui vit sur le disque',
        projects: {
          term: 'Projets',
          detail:
            'fichiers, là où vous choisissez de les enregistrer — voir Projets pour le dossier par défaut.',
        },
        preferences: {
          term: 'Préférences',
          detail:
            'Stockage du navigateur dans l’origine propre de cette application, pas un fichier que vous pouvez ouvrir directement.',
        },
        componentData: {
          term: 'Données de composants',
          detail:
            'Aucune. Chaque composant de cette version est compilé en dur ; rien n’est téléchargé ni mis en cache.',
        },
        logs: {
          term: 'Journaux',
          detail:
            'Aucun écrit sur le disque. Un journal d’exécution est conservé en mémoire tant que la fenêtre est ouverte et supprimé à sa fermeture.',
        },
      },
      notBuilt: {
        title: 'Pas encore construit',
        copy: 'Il n’y a pas d’import ni d’export des réglages, et aucun moyen de déplacer les préférences entre machines autrement qu’en les redéfinissant là-bas. Un projet lui-même est déjà portable — c’est un seul fichier — mais les préférences de cet écran ne le sont pas.',
      },
    },

    updates: {
      thisBuild: {
        title: 'Cette version',
        channel: {
          label: 'Comment une plus récente arrive sur cette machine',
          hint: 'Ce qui se passe quand une nouvelle version sort.',
          fact: 'Aucun canal de mise à jour. Mettre à jour signifie télécharger un nouvel installateur et l’installer par-dessus celui-ci.',
        },
      },
      verify: {
        title: 'Vérifier ce que vous installez',
        copy: 'Les versions ne sont pas signées, donc Windows avertira d’un éditeur non reconnu — un avertissement exact, puisque rien ici ne prouve qui a produit le fichier. Chaque version publie à la place une empreinte SHA-256, pour vérifier un installateur avant de l’exécuter.',
      },
      notBuilt: {
        title: 'Pas encore construit',
        copy: 'La vérification automatique des mises à jour, les canaux de mise à jour comme mécanisme fonctionnel, et les téléchargements en arrière-plan ne sont pas construits. Vérifier s’il existe une nouvelle version signifie aujourd’hui le faire à la main.',
      },
    },

    account: {
      title: 'Aucun compte',
      copy: 'Il n’y a ni connexion, ni compte, ni serveur auquel parler. Rien ici n’a d’abonnement, de forfait, de session, ni de liste d’appareils à gérer — chaque projet et chaque préférence de cet écran vit sur cette machine, et seulement sur cette machine.',
    },

    developer: {
      internals: {
        title: 'Fonctionnement interne',
        developerMode: {
          label: 'Mode développeur',
          hint: 'Affiche les valeurs brutes des préférences et un résumé compact de chaque composant chargé, ci-dessous.',
        },
      },
      currentPreferences: {
        title: 'Préférences actuelles',
      },
      loadedComponents: {
        title: 'Composants chargés',
      },
      hidden: {
        title: 'Actuellement masqué',
        copy: 'Activez le mode développeur ci-dessus pour voir les valeurs brutes des préférences et un résumé de chaque composant chargé.',
      },
      reset: {
        title: 'Réinitialisation',
        restoreDefaults: {
          label: 'Restaurer les valeurs par défaut',
          hint: 'Remet chaque réglage de cet écran à son état du premier lancement. Ne touche pas à vos projets, autorisations accordées, ni composants installés.',
          button: 'Réinitialiser tous les réglages',
        },
      },
    },

    diagnostics: {
      rows: {
        version: 'Version d’Encastra',
        runtime: 'Runtime',
        protocolSchema: 'Schéma du protocole de composants',
        projectSchema: 'Schéma du format de projet',
        components: 'Composants installés',
        platform: 'Plateforme',
        architecture: 'Architecture',
        gpu: 'GPU',
        userAgent: 'Agent utilisateur du WebView',
        gpuUnknown: 'Indisponible',
        platformUnknown: 'Inconnue',
        architectureUnknown: 'Non indiquée par le WebView',
      },
      machine: {
        title: 'Cette machine et cette version',
      },
      share: {
        title: 'Le partager',
        copy: {
          label: 'Copier',
          hint: 'Copie toutes les lignes ci-dessus dans le presse-papiers.',
          button: 'Copier',
          copied: 'Copié',
          failed: 'Impossible de copier',
        },
        export: {
          label: 'Exporter',
          hint: 'Enregistre le même rapport sous forme de fichier texte.',
          button: 'Exporter…',
        },
        note: 'Rien ici n’inclut de chemin de projet, de valeur de préférence, ni de jeton — c’est pensé pour pouvoir être collé quelque part de public sans risque. Le rapport est copié et exporté en anglais, afin que toute l’équipe puisse le lire.',
      },
    },

    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Construisez des logiciels à partir de pièces qui s’assemblent vraiment.',
      },
      thisBuild: {
        title: 'Cette version',
        componentProtocol: {
          label: 'Protocole des composants',
          hint: 'Ce que le manifeste d’un composant doit respecter pour se charger.',
        },
        projectFormat: {
          label: 'Format de projet',
        },
        updates: {
          label: 'Mises à jour',
          hint: 'Comment une version plus récente arrive sur cette machine.',
          fact: 'Aucun canal de mise à jour. Mettre à jour signifie télécharger un nouvel installateur.',
        },
      },
      readMore: {
        title: 'En savoir plus',
        readme: 'ce qu’est Encastra',
        security: 'le modèle de permissions, en entier',
        release: 'comment une version est produite et vérifiée',
        roadmap: 'ce qui est construit, et ce qui ne l’est pas encore',
      },
    },
  },
};

export default fr;
