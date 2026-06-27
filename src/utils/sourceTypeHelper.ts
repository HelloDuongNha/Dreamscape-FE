export function resolveSourceType(source: any): 'uploaded_pdf' | 'doi' | 'isbn' | 'web_url' | 'unspecified' {
  if (source?.sourceOrigin && source.sourceOrigin !== 'unspecified') {
    return source.sourceOrigin as any;
  }
  if (source?.contributionType === 'pdf_upload' || source?.sourceType === 'pdf_upload') {
    return 'uploaded_pdf';
  }
  if (source?.contributionType === 'isbn' || source?.sourceType === 'isbn') {
    return 'isbn';
  }
  if (source?.contributionType === 'doi' || source?.sourceType === 'doi') {
    return 'doi';
  }
  if (source?.contributionType === 'web_url' || source?.sourceType === 'web_url') {
    return 'web_url';
  }

  // fallback heuristics
  if (source?.originalFile) {
    return 'uploaded_pdf';
  }
  if (source?.isbn || source?.metadata?.isbn) {
    return 'isbn';
  }
  if (source?.doi) {
    return 'doi';
  }
  if (source?.url || source?.fullTextUrl || source?.sourceUrl) {
    return 'web_url';
  }
  return 'unspecified';
}
