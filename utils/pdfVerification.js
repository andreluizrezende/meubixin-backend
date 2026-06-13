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
    // 'binary' preserva os bytes sem transformação
    const pdfString = pdfBuffer.toString('binary');

    const hasSignatureObject = /\/Type\s*\/Sig/.test(pdfString);
    const hasByteRange       = /\/ByteRange\s*[\[<]/.test(pdfString);
    const hasContents        = /\/Contents\s*</.test(pdfString);
    const hasSignatureFilter = /\/(Adobe\.PPKLite|Adobe\.PPKMS|adbe\.pkcs7\.detached|adbe\.pkcs7\.sha1|ETSI\.CAdES\.detached|ETSI\.RFC3161)/i.test(pdfString);

    const isSigned = hasSignatureObject || (hasByteRange && hasContents);

    console.log('verifyPDF →', {
      hasSignatureObject,
      hasByteRange,
      hasContents,
      hasSignatureFilter,
      isSigned
    });

    return { verified: isSigned };

  } catch (error) {
    console.error('Erro ao verificar assinatura do PDF:', error);
    return { verified: false, error: error.message };
  }
}
module.exports = { verifyPDF };