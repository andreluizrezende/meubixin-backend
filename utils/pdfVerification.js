// ============================================
// VERIFICAÇÃO SIMPLES: Apenas detecta se o PDF foi assinado
// ============================================

/**
 * Verifica se um PDF contém assinatura digital
 * @param {Buffer} pdfBuffer - Buffer do arquivo PDF
 * @returns {Object} { verified: boolean }
 */
function verifyPDF(pdfBuffer) {
  try {
    const pdfString = pdfBuffer.toString('latin1');
    
    // Indicadores de que o PDF tem assinatura digital:
    
    // 1. Presença do objeto /Type /Sig (objeto de assinatura)
    const hasSignatureObject = pdfString.includes('/Type/Sig') || 
                               pdfString.includes('/Type /Sig');
    
    // 2. Presença de /ByteRange (alcance dos bytes assinados)
    const hasByteRange = pdfString.includes('/ByteRange');
    
    // 3. Presença de /Contents (conteúdo da assinatura)
    const hasContents = pdfString.includes('/Contents<') || 
                        pdfString.includes('/Contents <');
    
    // 4. Filtros de assinatura conhecidos
    const hasSignatureFilter = pdfString.includes('/Adobe.PPKLite') ||
                               pdfString.includes('/Adobe.PPKMS') ||
                               pdfString.includes('/adbe.pkcs7.detached') ||
                               pdfString.includes('/adbe.pkcs7.sha1') ||
                               pdfString.includes('/ETSI.CAdES.detached') ||
                               pdfString.includes('/ETSI.RFC3161');
    
    // PDF está assinado se tiver pelo menos:
    // - Objeto de assinatura OU
    // - ByteRange + Contents + Filtro de assinatura
    const isSigned = hasSignatureObject || 
                     (hasByteRange && hasContents && hasSignatureFilter);
    
    return {
      verified: isSigned
    };
    
  } catch (error) {
    console.error('Erro ao verificar assinatura do PDF:', error);
    return {
      verified: false,
      error: error.message
    };
  }
}

module.exports = { verifyPDF };