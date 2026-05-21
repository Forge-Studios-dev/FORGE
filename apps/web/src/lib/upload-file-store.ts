/** Holds the selected File across /upload/step/* navigations (File cannot live in sessionStorage). */
let pendingUploadFile: File | null = null;

export function setUploadFile(file: File | null) {
  pendingUploadFile = file;
}

export function getUploadFile(): File | null {
  return pendingUploadFile;
}

export function clearUploadFile() {
  pendingUploadFile = null;
}
