import { ConfirmDialog, FolderDialog } from '#components'

// The dialogs behind "New folder", "Rename" and "Delete", shared by the
// sidebar, the Move menu and the rule editor
export function useFolderDialogs() {
  const overlay = useOverlay()
  const { folders, createFolder, renameFolder, deleteFolder } = useMail()

  async function promptCreate(parent?: string): Promise<string | undefined> {
    const modal = overlay.create(FolderDialog, {
      props: { title: 'New folder', parents: folders.value.filter(folder => !folder.role), parent }
    })
    const result = await modal.open().result
    return result ? createFolder(result.name, result.parent) : undefined
  }

  async function promptRename(folder: Folder) {
    const modal = overlay.create(FolderDialog, { props: { title: 'Rename folder', name: folder.name, confirmLabel: 'Rename' } })
    const result = await modal.open().result
    if (result && result.name !== folder.name) await renameFolder(folder, result.name)
  }

  async function promptDelete(folder: Folder) {
    const modal = overlay.create(ConfirmDialog, {
      props: {
        title: `Delete ${folder.name}?`,
        message: 'Only the folder goes. Its messages move back to your Inbox.',
        confirmLabel: 'Delete folder',
        color: 'primary'
      }
    })
    if (await modal.open().result) await deleteFolder(folder)
  }

  return { promptCreate, promptRename, promptDelete }
}
