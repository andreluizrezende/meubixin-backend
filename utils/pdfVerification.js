/**
 * Verifica se um PDF contém assinatura digital (PAdES/PKCS7/CMS)
 * Suporta assinaturas do ITI gov.br (PAdES-BASELINE, CAdES.detached)
 * @param {Buffer} pdfBuffer
 * @returns {{ verified: boolean, reason?: string }}
 */
function verifyPDF(pdfBuffer) {
  try {
    // Busca binária direta no buffer (mais confiável que regex em latin1)
    const has = (str) => pdfBuffer.includes(Buffer.from(str, 'latin1'))

    // /ByteRange é obrigatório em todo PDF assinado (não pode ser comprimido)
    const hasByteRange = has('/ByteRange')

    // Tipos de objeto de assinatura
    const hasTypeSig = has('/Type /Sig') || has('/Type/Sig') ||
                       has('/Type /DocTimestamp') || has('/Type/DocTimestamp')

    // Sub-filtros conhecidos (Adobe, ETSI/PAdES, CAdES)
    const hasSubFilter = has('/SubFilter /adbe.pkcs7.detached') ||
                         has('/SubFilter/adbe.pkcs7.detached') ||
                         has('/SubFilter /adbe.pkcs7.sha1') ||
                         has('/SubFilter/adbe.pkcs7.sha1') ||
                         has('/SubFilter /ETSI.CAdES.detached') ||
                         has('/SubFilter/ETSI.CAdES.detached') ||
                         has('/SubFilter /ETSI.RFC3161') ||
                         has('/SubFilter/ETSI.RFC3161') ||
                         has('/adbe.pkcs7') ||
                         has('/ETSI.CAdES') ||
                         has('/ETSI.RFC3161')

    // /Contents presente (dado binário da assinatura)
    const hasContents = has('/Contents')

    // Campo de assinatura no AcroForm
    const hasSigField = has('/Sig') || has('/DocTimestamp')

    // ITI gov.br usa marcador ETSI nos metadados
    const hasETSI = has('ETSI') || has('CAdES') || has('pkcs7')

    const isSigned = hasByteRange ||
                     (hasTypeSig && hasContents) ||
                     (hasSubFilter && hasContents) ||
                     (hasSigField && hasETSI)

    console.log('verifyPDF →', {
      hasByteRange,
      hasTypeSig,
      hasSubFilter,
      hasContents,
      hasSigField,
      hasETSI,
      isSigned
    })

    return { verified: isSigned }

  } catch (error) {
    console.error('Erro ao verificar assinatura do PDF:', error)
    return { verified: false, error: error.message }
  }
}

module.exports = { verifyPDF }
