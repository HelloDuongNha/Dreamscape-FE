import type { OracleEvidenceGapItem } from '@/api/moderationApi'

export type EvidenceResearchLanguage = 'vi' | 'en'

function uniqueClaims(gap: OracleEvidenceGapItem, language: EvidenceResearchLanguage): string[] {
  const localized = gap.localizedRelatedClaims?.[language] || []
  const primary = gap.localizedClaims?.[language] || gap.claim
  return [...new Set([primary, ...localized].map((claim) => claim.trim()).filter(Boolean))]
}

// Builds an ephemeral research brief; the prompt is never persisted with user data.
export function buildEvidenceResearchPrompt(
  gap: OracleEvidenceGapItem,
  language: EvidenceResearchLanguage,
): string {
  const [claim, ...variants] = uniqueClaims(gap, language)
  if (language === 'en') {
    return [
      'Conduct a focused Deep Research review to verify or refute this exact claim:',
      `"${claim}"`,
      ...(variants.length
        ? ['', 'Equivalent phrasings already merged into this evidence need:', ...variants.map((item) => `- ${item}`)]
        : []),
      '',
      'Preserve the direction, population, context, and strength of the claim. Translate non-English concepts into precise academic English without broadening them.',
      'Search at least two scholarly indexes: Crossref, OpenAlex, PubMed/PMC, Semantic Scholar, Google Scholar, DOAJ, or the official publisher website.',
      'Use the claim and its merged variants as concept-level queries; also try the subject, proposed relationship, and outcome as separate keyword groups.',
      'Verify every DOI through doi.org or Crossref. Verify open-access full text through PMC, DOAJ, an institutional repository, or the publisher. Never invent a DOI, quotation, or PDF URL.',
      '',
      'Prioritize peer-reviewed primary studies and academic reviews. Keep reputable web or news material in a separate “context only” section and trace it back to the original study.',
      'Exclude dream-symbol dictionaries, personal blogs, SEO pages, anonymous posts, and sources whose underlying study cannot be identified.',
      '',
      'For each result return: title, authors, year, source type, verified DOI or stable URL, study design, sample, method, relevant finding, exact supporting or refuting quotation with page/section, and limitations.',
      'Classify every result as direct support, partial support, contradictory evidence, or irrelevant. A broad source must not prove a narrower claim.',
      'Finish with the narrowest defensible argument (factor/subject → outcome), its scope and limitations, and the exact verified excerpts that support it.',
    ].join('\n')
  }

  return [
    'Hãy thực hiện một lượt Deep Research có trọng tâm để kiểm chứng hoặc phản bác trực tiếp nhận định sau:',
    `"${claim}"`,
    ...(variants.length
      ? ['', 'Các cách diễn đạt tương đương đã được gộp vào cùng nhu cầu dẫn chứng:', ...variants.map((item) => `- ${item}`)]
      : []),
    '',
    'Giữ nguyên chiều quan hệ, đối tượng, bối cảnh và mức độ khẳng định. Nếu cần dịch khái niệm sang tiếng Anh học thuật thì không được mở rộng nội dung.',
    'Tìm trên ít nhất hai hệ thống học thuật: Crossref, OpenAlex, PubMed/PMC, Semantic Scholar, Google Scholar, DOAJ hoặc trang chính thức của nhà xuất bản.',
    'Dùng nhận định và các cách diễn đạt đã gộp làm truy vấn theo cụm khái niệm; đồng thời tách chủ thể, quan hệ được đề xuất và kết quả thành các nhóm từ khóa riêng.',
    'Xác minh DOI bằng doi.org hoặc Crossref. Kiểm tra toàn văn mở qua PMC, DOAJ, kho trường/viện hoặc nhà xuất bản. Không tự tạo DOI, trích dẫn hay URL PDF.',
    '',
    'Ưu tiên nghiên cứu gốc bình duyệt và tổng quan học thuật. Tách bài web hoặc tin khoa học uy tín vào mục “chỉ dùng làm bối cảnh” và phải truy ngược được nghiên cứu gốc.',
    'Loại từ điển biểu tượng giấc mơ, blog cá nhân, trang SEO, bài ẩn danh và nguồn không xác định được nghiên cứu nền.',
    '',
    'Với từng kết quả, cung cấp: tiêu đề, tác giả, năm, loại nguồn, DOI hoặc URL ổn định đã kiểm chứng, thiết kế nghiên cứu, cỡ mẫu, phương pháp, kết quả liên quan, trích đoạn nguyên văn hỗ trợ hoặc phản bác kèm trang/mục và giới hạn.',
    'Phân loại từng nguồn: hỗ trợ trực tiếp, hỗ trợ một phần, bằng chứng trái chiều hoặc không liên quan. Không dùng nguồn rộng để chứng minh kết luận hẹp hơn.',
    'Kết thúc bằng lập luận hẹp nhất có thể bảo vệ (yếu tố/chủ thể → kết quả), phạm vi, giới hạn và các trích đoạn nguyên văn đã kiểm chứng.',
  ].join('\n')
}
