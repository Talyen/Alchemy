export function campaignActLabel(act: number): string {
  return `Act ${["I", "II", "III"][act - 1] ?? act}`;
}
