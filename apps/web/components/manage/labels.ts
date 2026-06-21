import type { Lang } from '@/lib/use-lang';

// EN/DE 1:1 strings for the project/chat management surfaces (kebab menus,
// confirm/rename/move dialogs, overview pages). Keep both languages in lockstep.
export function manageLabels(lang: Lang) {
  const de = {
    rename: 'Umbenennen',
    delete: 'Löschen',
    move: 'Verschieben',
    cancel: 'Abbrechen',
    save: 'Speichern',
    more: 'Mehr',
    // rename
    renameProjectTitle: 'Projekt umbenennen',
    renameChatTitle: 'Chat umbenennen',
    namePlaceholder: 'Name',
    renamed: 'Umbenannt',
    renameFailed: 'Umbenennen fehlgeschlagen',
    // delete — project
    deleteProjectTitle: 'Projekt löschen?',
    deleteProjectBody:
      'Das Projekt und alle seine Chats und Builds werden endgültig entfernt. Eine bereits veröffentlichte Seite bleibt unter Umständen weiter online und muss separat deaktiviert werden.',
    deleteChatTitle: 'Chat löschen?',
    deleteChatBody: 'Dieser Chat und sein Verlauf werden endgültig entfernt.',
    deleted: 'Gelöscht',
    deleteFailed: 'Löschen fehlgeschlagen',
    // bulk
    bulkDeleteProjectsTitle: (n: number) => `${n} Projekte endgültig löschen?`,
    bulkDeleteChatsTitle: (n: number) => `${n} Chats endgültig löschen?`,
    bulkDeleteProjectsBody:
      'Alle ausgewählten Projekte samt Chats und Builds werden endgültig entfernt. Veröffentlichte Seiten bleiben unter Umständen online.',
    bulkDeleteChatsBody: 'Alle ausgewählten Chats werden endgültig entfernt.',
    // move
    moveTitle: 'In Projekt verschieben',
    noProject: 'Kein Projekt',
    moved: 'Verschoben',
    moveFailed: 'Verschieben fehlgeschlagen',
    // overview
    projectsTitle: 'Projekte',
    chatsTitle: 'Chats',
    select: 'Auswählen',
    selectAll: 'Alle auswählen',
    done: 'Fertig',
    selectedCount: (n: number) => `${n} ausgewählt`,
    noProjects: 'Noch keine Projekte',
    noChats: 'Noch keine Chats',
    openProject: 'Projekt öffnen',
    openChat: 'Chat öffnen',
  };
  const en: typeof de = {
    rename: 'Rename',
    delete: 'Delete',
    move: 'Move',
    cancel: 'Cancel',
    save: 'Save',
    more: 'More',
    renameProjectTitle: 'Rename project',
    renameChatTitle: 'Rename chat',
    namePlaceholder: 'Name',
    renamed: 'Renamed',
    renameFailed: 'Rename failed',
    deleteProjectTitle: 'Delete project?',
    deleteProjectBody:
      'The project and all of its chats and builds will be permanently removed. An already-published site may stay online and has to be taken down separately.',
    deleteChatTitle: 'Delete chat?',
    deleteChatBody: 'This chat and its history will be permanently removed.',
    deleted: 'Deleted',
    deleteFailed: 'Delete failed',
    bulkDeleteProjectsTitle: (n: number) => `Permanently delete ${n} projects?`,
    bulkDeleteChatsTitle: (n: number) => `Permanently delete ${n} chats?`,
    bulkDeleteProjectsBody:
      'All selected projects, including their chats and builds, will be permanently removed. Published sites may stay online.',
    bulkDeleteChatsBody: 'All selected chats will be permanently removed.',
    moveTitle: 'Move to project',
    noProject: 'No project',
    moved: 'Moved',
    moveFailed: 'Move failed',
    projectsTitle: 'Projects',
    chatsTitle: 'Chats',
    select: 'Select',
    selectAll: 'Select all',
    done: 'Done',
    selectedCount: (n: number) => `${n} selected`,
    noProjects: 'No projects yet',
    noChats: 'No chats yet',
    openProject: 'Open project',
    openChat: 'Open chat',
  };
  return lang === 'en' ? en : de;
}
