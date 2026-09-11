/**
 * Français. Toute clé ici doit aussi exister en anglais — vérifié par `i18n.test.ts`. Une clé
 * absente retombe simplement sur l'anglais ; une traduction incertaine n'est pas incluse.
 */

import type { Messages } from '../index';

const fr: Messages = {
  common: {
    close: 'Fermer',
    dismiss: 'Ignorer',
  },

  sidebar: {
    ariaLabel: 'Sections',
    running: ', en cours d’exécution',
    items: {
      home: 'Accueil',
      builder: 'Constructeur',
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
    },
    empty: {
      heading: 'Votre canevas est vide',
      body: 'Un flux de travail est un petit nombre de composants reliés entre eux. Choisissez-en un à gauche pour placer votre première étape, reliez sa sortie à la suivante, puis appuyez sur Exécuter.',
      hint: 'Chaque composant indique ce qu’il peut atteindre avant de s’exécuter, et rien ne touche vos fichiers tant que vous ne l’avez pas autorisé.',
    },
    keysHint:
      'Utilisez les flèches pour vous déplacer entre les étapes, Entrée pour ouvrir une étape dans l’inspecteur, Échap pour désélectionner, et Suppr pour retirer l’étape sélectionnée.',
    a11y: {
      selected: '{name}, étape {index} sur {total}, sélectionnée.',
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
