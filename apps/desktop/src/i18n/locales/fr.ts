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
        description: 'Apparence, mouvement, et la visite guidée du premier lancement.',
      },
      workspace: {
        label: 'Espace de travail',
        description: 'Où vivent les projets, et ce sur quoi s’ouvre cette application.',
      },
      editor: {
        label: 'Éditeur',
        description: 'Aides affichées sur le canevas pendant la construction d’un graphe.',
      },
      runtime: {
        label: 'Exécution',
        description: 'Ce qui s’affiche à l’écran pendant l’exécution d’un flux de travail.',
      },
      components: {
        label: 'Composants',
        description: 'Ce qui est installé dans cette version, et ce que chacun peut atteindre.',
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
      advanced: {
        label: 'Avancé',
        description:
          'Les détails internes pour qui les veut, et un moyen de revenir aux valeurs par défaut.',
      },
      about: {
        label: 'À propos',
        description: 'Version, compilation, et où vit la documentation complète.',
      },
    },
    general: {
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
      getStarted: {
        title: 'Prise en main',
        welcomeTour: {
          label: 'Visite de bienvenue',
          hint: 'Le premier flux de travail guidé, affiché une fois au premier lancement.',
          button: 'Réafficher la bienvenue',
        },
      },
    },
    workspace: {
      projects: {
        title: 'Projets',
        folder: {
          label: 'Dossier de projets par défaut',
          hint: 'Là où s’ouvre la boîte de dialogue d’enregistrement. Laissé vide, elle s’ouvre là où le système était pour la dernière fois.',
          placeholder: 'Aucun dossier par défaut défini',
          browseTitleUnavailable:
            'Nécessite le moteur de bureau, pas cet aperçu dans le navigateur',
        },
        startup: {
          label: 'Au démarrage',
          hint: 'Ce que cette application affiche à l’ouverture.',
          options: {
            home: 'Accueil',
            lastProject: 'Dernier projet',
          },
        },
      },
    },
    editor: {
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
    },
    runtime: {
      runs: {
        title: 'Exécutions',
        openRunPanel: {
          label: 'Ouvrir le panneau d’exécution',
          hint: 'Ramène automatiquement le panneau d’exécution au premier plan dès qu’une exécution démarre.',
        },
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
          button: 'Ouvrir Sécurité',
        },
      },
      installMore: {
        title: 'Installer davantage',
        installFromFile: {
          label: 'Installer depuis un fichier',
          hint: 'Ajouter un composant tiers à cette version.',
          status: 'Pas encore construit',
        },
        note: 'Le bac à sable où ces composants s’exécuteraient est conçu et documenté mais pas encore construit, donc rien en dehors des {count} listés ci-dessus ne peut être installé pour l’instant.',
      },
    },
    security: {
      permissionModel: {
        title: 'Modèle de permissions',
        copy: 'Un composant ne peut pas accéder à vos fichiers, à votre réseau ou à votre presse-papiers, sauf si son manifeste le déclare et que vous l’autorisez — une fois par exécution. Chaque demande, autorisée ou refusée, est enregistrée là où vous pouvez la consulter.',
        allowedInOpenWorkflow: {
          label: 'Autorisé dans le flux de travail ouvert',
          hint: 'Effacé dès que cette application se ferme.',
          nothingAllowed: 'Rien d’autorisé',
          allowed: '{count} autorisés',
        },
        fullDetail: {
          label: 'Détail complet',
          hint: 'Ce qui a été autorisé, à quoi, et ce que cela ne protège pas.',
          button: 'Ouvrir Sécurité',
        },
      },
    },
    privacy: {
      collection: {
        title: 'Collecte',
        telemetry: {
          label: 'Télémétrie',
          hint: 'Données d’usage renvoyées à un serveur.',
          status: 'Aucune collectée',
        },
        crashReports: {
          label: 'Rapports de plantage',
          hint: 'Rapports automatiques envoyés quelque part en cas de défaillance.',
          status: 'Aucun',
        },
        analytics: {
          label: 'Analytique',
          hint: 'Schémas d’usage, comptages de fonctionnalités, ou toute chose similaire.',
          status: 'Aucune',
        },
        account: {
          label: 'Compte',
          hint: 'Une connexion ou un abonnement lié à cette application.',
          status: 'Aucun — il n’y a pas de serveur',
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
    advanced: {
      internals: {
        title: 'Fonctionnement interne',
        developerMode: {
          label: 'Mode développeur',
          hint: 'Affiche les identifiants de composants, les empreintes, et le journal d’exécution brut pour qui les veut.',
        },
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
    about: {
      brand: {
        title: 'Encastra',
        tagline: 'Construisez des logiciels à partir de pièces qui s’assemblent vraiment.',
      },
      thisBuild: {
        title: 'Cette version',
        version: {
          label: 'Version',
          hint: 'La version que vous exécutez.',
          unknown: 'inconnue',
        },
        runtime: {
          label: 'Exécution',
          hint: 'Si un véritable moteur Encastra est rattaché à cette fenêtre.',
          attached: 'Rattaché',
          notAttached: 'Non rattaché — aperçu dans le navigateur',
        },
        componentProtocol: {
          label: 'Protocole des composants',
          hint: 'Ce que le manifeste d’un composant doit respecter pour se charger.',
        },
        projectFormat: {
          label: 'Format de projet',
          hint: 'Comment un fichier .encastra enregistré est écrit.',
        },
        signing: {
          label: 'Signature',
          hint: 'Si cette version peut prouver qui l’a produite.',
          status: 'Non signée',
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
