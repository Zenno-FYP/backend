/**
 * Maps raw app names (from the desktop agent) to coarse categories for analytics.
 * Heuristic only — adjust patterns as you learn real process names on each OS.
 *
 * Order: first matching rule wins (list is checked from top to bottom).
 */

const RULES: { category: string; patterns: string[] }[] = [
  {
    category: 'Browser',
    patterns: [
      'chrome',
      'chromium',
      'firefox',
      'mozilla',
      'msedge',
      'edge',
      'brave',
      'safari',
      'opera',
      'arc',
      'vivaldi',
      'browser',
    ],
  },
  {
    category: 'Communication',
    patterns: [
      'slack',
      'teams',
      'discord',
      'zoom',
      'meet',
      'outlook',
      'mail',
      'e-mail',
      'thunderbird',
      'telegram',
      'whatsapp',
      'signal',
      'skype',
      'webex',
      'messenger',
      'gmail',
    ],
  },
  {
    category: 'Design',
    patterns: [
      'figma',
      'sketch',
      'photoshop',
      'illustrator',
      'indesign',
      'lightroom',
      'premiere',
      'after effects',
      'canva',
      'framer',
      'invision',
      'zeplin',
      'affinity',
      'blender',
    ],
  },
  {
    category: 'Productivity',
    patterns: [
      'notion',
      'obsidian',
      'trello',
      'asana',
      'jira',
      'confluence',
      'linear',
      'clickup',
      'microsoft excel',
      'microsoft word',
      'microsoft powerpoint',
      'winword',
      'powerpnt',
      'onenote',
      'evernote',
      'calendar',
      'reminders',
      'apple notes',
      'numbers',
      'pages',
      'keynote',
    ],
  },
  {
    category: 'Development',
    patterns: [
      'vscode',
      'vs code',
      'visual studio',
      'cursor',
      'jetbrains',
      'intellij',
      'pycharm',
      'webstorm',
      'goland',
      'rider',
      'clion',
      'rustrover',
      'xcode',
      'android studio',
      'sublime',
      'atom',
      'neovim',
      'vim',
      'emacs',
      'terminal',
      'iterm',
      'warp',
      'hyper',
      'windows terminal',
      'powershell',
      'cmd.exe',
      'docker',
      'podman',
      'kubernetes',
      'postman',
      'insomnia',
      'dbeaver',
      'datagrip',
      'github',
      'gitlab',
      'gitkraken',
      'sourcetree',
      'fork',
      'tower',
      'code.exe',
      'devenv',
    ],
  },
];

/**
 * Normalize for substring matching (lowercase, common separators → space).
 */
function normalizeAppName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function categorizeAppName(rawName: string): string {
  const n = normalizeAppName(rawName);
  if (!n) {
    return 'Other';
  }

  /** Short display names (macOS / some agents) */
  if (n === 'code' || n === 'zed') {
    return 'Development';
  }

  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (n.includes(p)) {
        return rule.category;
      }
    }
  }

  return 'Other';
}
