export function isValidBackupBase64(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) return false;
  const paddingLength = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const dataLength = value.length - paddingLength;
  if (dataLength % 4 !== (paddingLength ? 4 - paddingLength : 0)) return false;

  for (let index = 0; index < dataLength; index += 1) {
    const code = value.charCodeAt(index);
    if (!(
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 43 ||
      code === 47
    )) return false;
  }
  return true;
}
