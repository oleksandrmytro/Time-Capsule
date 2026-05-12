import type { FilePickerTypeOption } from "@/lib/media-types"

type OpenNativeFilesOptions = {
  multiple?: boolean
  types?: FilePickerTypeOption[]
  excludeAcceptAllOption?: boolean
}

type FileHandleLike = {
  getFile: () => Promise<File>
}

export function isNativeFilePickerSupported(): boolean {
  if (typeof window === "undefined") return false
  return typeof (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker === "function"
}

export async function openNativeFiles(options: OpenNativeFilesOptions): Promise<File[] | null> {
  if (!isNativeFilePickerSupported()) return null

  const picker = (window as unknown as {
    showOpenFilePicker: (args: {
      multiple?: boolean
      types?: FilePickerTypeOption[]
      excludeAcceptAllOption?: boolean
    }) => Promise<FileHandleLike[]>
  }).showOpenFilePicker

  try {
    const handles = await picker({
      multiple: options.multiple ?? false,
      types: options.types ?? [],
      excludeAcceptAllOption: options.excludeAcceptAllOption ?? false,
    })
    return Promise.all(handles.map((handle) => handle.getFile()))
  } catch (error) {
    const domError = error as { name?: string } | null
    if (domError?.name === "AbortError") return []
    return null
  }
}
