/*
 * CHANGES (VISUAL ONLY):
 * 1. Adicionadas constantes SIZES e SPACING para padronização tipográfica e espaçamentos
 * 2. Refinado o header: barra roxa com altura reduzida (48px), título menor e mais profissional
 * 3. Melhorado grid do bloco de informações: padding interno consistente (16px), alinhamento refinado
 * 4. Ajustadas proporções das colunas da tabela para melhor equilíbrio visual
 * 5. Implementado padding real nas células da tabela (8px horizontal) com maxWidth correto
 * 6. Aumentado rowH para 26px e headH para 32px para melhor respiro visual
 * 7. Aplicado truncamento elegante no nome do produto com "…" quando excede espaço
 * 8. Suavizado efeito zebra (bg mais claro) e refinadas bordas da tabela (0.5px)
 * 9. Redesenhado box de totais: header mais discreto, hierarquia clara, separador refinado
 * 10. Melhorado bloco de observações: line-height aumentado (14px), padding interno consistente
 * 11. Refinado footer: linha divisória mais sutil, texto com tamanho e espaçamento profissional
 * 12. Ajustados todos os tamanhos de fonte para hierarquia clara (8-16pt)
 * 13. Consistência de cores: textos com BRAND.text/textMuted, bordas com BRAND.border
 * 14. Melhorado espaçamento vertical entre seções (20-28px) para layout mais respirável
 * 15. Adicionado tratamento de truncamento para SKU também (limite 12 chars)
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

// >>>> DADOS DA EMPRESA (EDITAR AQUI) <<
const FATURANTE = {
  razaoSocial: 'CDA FOODS LTDA',
  nomeFantasia: 'CDA Foods',
  cnpj: '00.000.000/0000-00',
  ie: '000000000',
  endereco: 'ENDEREÇO COMPLETO, Nº, BAIRRO, CEP',
  cidade: 'RECIFE',
  uf: 'PE',
  telefone: '(81) 00000-0000',
  email: 'contato@cdafoods.com.br',
}

// === CORES E ESTILOS ===
const BRAND = {
  primary: rgb(0x45 / 255, 0x00 / 255, 0x57 / 255),
  primaryDark: rgb(0x30 / 255, 0x00 / 255, 0x3d / 255),
  bgLight: rgb(0.98, 0.98, 0.98),
  bgZebra: rgb(0.992, 0.992, 0.992),
  text: rgb(0.08, 0.08, 0.08),
  textMuted: rgb(0.45, 0.45, 0.45),
  border: rgb(0.88, 0.88, 0.88),
  white: rgb(1, 1, 1),
}

// === PADRONIZAÇÃO TIPOGRÁFICA ===
const SIZES = {
  title: 16,
  subtitle: 11,
  sectionTitle: 10.5,
  body: 9.5,
  bodySmall: 9,
  label: 9,
  footer: 8.5,
  tableHeader: 10,
  tableBody: 9.5,
  totalLabel: 10.5,
  totalValue: 14,
}

const SPACING = {
  sectionGap: 28,
  blockGap: 20,
  lineHeight: 14,
  padding: 16,
  paddingSmall: 12,
  paddingTable: 8,
}

// === MEDIDAS A4 ===
const A4_W = 595.28
const A4_H = 841.89
const M = 36

function safeStr(v: any): string {
  return v == null ? '' : String(v)
}

function formatDatePtBR(value: any): string {
  if (!value) return '-'
  const d = typeof value === 'number' ? new Date(value) : value?.toDate ? value.toDate() : new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function brl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0)
}

function n2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100
}

function inferKind(order: Order, kind?: PdfKind): PdfKind {
  if (kind) return kind
  return (order as any).status === 'orcamento' ? 'ORCAMENTO' : 'PEDIDO'
}

function docNumber(order: Order, kind: PdfKind): string {
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = safeStr((order as any).orderNumber).trim()
  if (!raw) return prefix
  return raw.startsWith('PED-') || raw.startsWith('ORC-') ? raw : `${prefix}-${raw}`
}

// Função auxiliar para truncar texto
function truncateText(font: any, text: string, size: number, maxWidth: number): string {
  const ellipsis = '…'
  const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size)
  
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  
  let truncated = ''
  for (let i = 0; i < text.length; i++) {
    const test = truncated + text[i]
    if (font.widthOfTextAtSize(test, size) + ellipsisWidth > maxWidth) {
      break
    }
    truncated = test
  }
  
  return truncated ? truncated + ellipsis : ellipsis
}

export async function generateOrderPdf(order: Order, kind?: PdfKind) {
  const K = inferKind(order, kind)
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const W = A4_W - 2 * M
  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - M

  // ===== HELPERS =====
  const drawBox = (x: number, yTop: number, w: number, h: number, fill?: any, border = true) => {
    page.drawRectangle({ 
      x, 
      y: yTop - h, 
      width: w, 
      height: h, 
      color: fill, 
      borderColor: border ? BRAND.border : undefined, 
      borderWidth: border ? 0.5 : 0 
    })
  }

  const drawText = (text: string, x: number, y: number, opts?: { bold?: boolean; size?: number; color?: any; maxWidth?: number; align?: 'left' | 'right' | 'center' }) => {
    const size = opts?.size ?? SIZES.body
    const f = opts?.bold ? fontB : font
    const color = opts?.color ?? BRAND.text
    const t = safeStr(text)

    if (opts?.align && opts.align !== 'left') {
      const w = f.widthOfTextAtSize(t, size)
      const xx = opts.align === 'right' ? x - w : x - w / 2
      page.drawText(t, { x: xx, y, size, font: f, color, maxWidth: opts?.maxWidth })
      return
    }
    page.drawText(t, { x, y, size, font: f, color, maxWidth: opts?.maxWidth })
  }

  const drawSectionTitle = (title: string, x: number, yTop: number) => {
    drawText(title, x, yTop - 12, { bold: true, size: SIZES.sectionTitle, color: BRAND.primaryDark })
  }

  const drawKV = (label: string, value: string, x: number, y: number, w: number) => {
    const L = `${label}:`
    drawText(L, x, y, { bold: true, size: SIZES.label, color: BRAND.text })
    const lw = fontB.widthOfTextAtSize(L, SIZES.label)
    drawText(value || '—', x + lw + 4, y, { size: SIZES.bodySmall, color: BRAND.text, maxWidth: w - lw - 4 })
  }

  const wrapText = (text: string, maxWidth: number, size: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''

    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      const wLen = font.widthOfTextAtSize(test, size)
      if (wLen <= maxWidth) line = test
      else {
        if (line) lines.push(line)
        line = w
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // ===== HEADER =====
  const drawHeader = (yTop: number): number => {
    // Barra roxa superior refinada
    const brandH = 48
    page.drawRectangle({ x: M, y: yTop - brandH, width: W, height: brandH, color: BRAND.primary })

    const title = K === 'PEDIDO' ? 'Pedido de Venda' : 'Orçamento'
    drawText(title, M + W / 2, yTop - 30, { bold: true, size: SIZES.title, align: 'center', color: BRAND.white })

    // Bloco branco com informações - padding interno consistente
    const h = 98
    const topBoxY = yTop - brandH - 16
    drawBox(M, topBoxY, W, h, BRAND.bgLight)

    // COLUNA ESQUERDA: Número e Data
    const leftX = M + SPACING.padding
    drawText(`Nº ${docNumber(order, K)}`, leftX, topBoxY - 34, { bold: true, size: 13 })
    drawText(`Data de Emissão: ${formatDatePtBR((order as any).createdAt)}`, leftX, topBoxY - 54, { 
      size: SIZES.bodySmall, 
      color: BRAND.textMuted 
    })

    // COLUNA DIREITA: Dados da Empresa
    const rightX = M + W - SPACING.padding
    const maxWidth = 220
    
    drawText(FATURANTE.nomeFantasia, rightX, topBoxY - 26, { bold: true, size: SIZES.subtitle, align: 'right', maxWidth })
    drawText(FATURANTE.razaoSocial, rightX, topBoxY - 40, { size: SIZES.bodySmall, align: 'right', color: BRAND.textMuted, maxWidth })
    drawText(`CNPJ: ${FATURANTE.cnpj} | IE: ${FATURANTE.ie}`, rightX, topBoxY - 54, { size: SIZES.bodySmall, align: 'right', maxWidth })
    drawText(FATURANTE.endereco, rightX, topBoxY - 67, { size: 8.5, align: 'right', color: BRAND.textMuted, maxWidth })
    drawText(`${FATURANTE.cidade}/${FATURANTE.uf} • ${FATURANTE.telefone}`, rightX, topBoxY - 80, { size: SIZES.bodySmall, align: 'right', maxWidth })
    drawText(FATURANTE.email, rightX, topBoxY - 92, { size: SIZES.bodySmall, align: 'right', maxWidth })

    return topBoxY - h - SPACING.sectionGap
  }

  y = drawHeader(y)

  const newPage = () => {
    page = pdfDoc.addPage([A4_W, A4_H])
    y = A4_H - M
    y = drawHeader(y)
  }

  // ===== CLIENTE BLOCK =====
  const c = (order as any).customerSnapshot || {}
  const cName = safeStr(c.name)
  const cDoc = safeStr(c.doc)
  const cPhone = safeStr(c.phone)
  const cEmail = safeStr(c.email)
  const cAddr = safeStr(c.address)

  const blockH = 104
  drawBox(M, y, W, blockH)

  drawSectionTitle('DADOS DO CLIENTE', M + SPACING.padding, y)

  const x1 = M + SPACING.padding
  const x2 = M + W / 2 + SPACING.padding
  const topY = y - 38

  drawKV('Cliente', cName, x1, topY, W / 2 - SPACING.padding * 2)
  drawKV('Documento', cDoc, x1, topY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Telefone', cPhone, x1, topY - 36, W / 2 - SPACING.padding * 2)

  drawKV('E-mail', cEmail, x2, topY, W / 2 - SPACING.padding * 2)

  const addrLabel = 'Endereço:'
  drawText(addrLabel, x2, topY - 18, { bold: true, size: SIZES.label })
  const lw = fontB.widthOfTextAtSize(addrLabel, SIZES.label)
  const addrLines = cAddr ? wrapText(cAddr, (W / 2 - SPACING.padding * 2) - lw - 4, SIZES.bodySmall).slice(0, 2) : ['—']
  drawText(addrLines[0], x2 + lw + 4, topY - 18, { size: SIZES.bodySmall, maxWidth: W / 2 - SPACING.padding * 2 - lw - 4 })
  if (addrLines[1]) drawText(addrLines[1], x2 + lw + 4, topY - 32, { size: SIZES.bodySmall, maxWidth: W / 2 - SPACING.padding * 2 - lw - 4 })

  y -= blockH + SPACING.sectionGap

  // ===== TABLE =====
  drawSectionTitle('ITENS DO PEDIDO', M + 4, y + 12)
  y -= 20

  // COLUNAS COM LARGURAS REFINADAS E PADDING REAL
  const colWidth = {
    idx: 32,
    sku: 75,
    prod: 215,
    und: 48,
    qtd: 52,
    unit: 72,
    sub: 72,
  }

  const tableStartX = M + 8
  const col = {
    idx: tableStartX,
    sku: tableStartX + colWidth.idx,
    prod: tableStartX + colWidth.idx + colWidth.sku,
    und: tableStartX + colWidth.idx + colWidth.sku + colWidth.prod,
    qtdR: tableStartX + colWidth.idx + colWidth.sku + colWidth.prod + colWidth.und,
    unitR: tableStartX + colWidth.idx + colWidth.sku + colWidth.prod + colWidth.und + colWidth.qtd,
    subR: tableStartX + colWidth.idx + colWidth.sku + colWidth.prod + colWidth.und + colWidth.qtd + colWidth.unit,
  }

  const rowH = 26
  const headH = 32

  const drawTableHeader = () => {
    drawBox(M, y, W, headH, BRAND.bgLight)

    const ty = y - 20
    drawText('#', col.idx + SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader })
    drawText('Código', col.sku + SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader })
    drawText('Produto', col.prod + SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader })
    drawText('Unid.', col.und + SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader })
    drawText('Qtde.', col.qtdR - SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader, align: 'right' })
    drawText('Preço Unit.', col.unitR - SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader, align: 'right' })
    drawText('Subtotal', col.subR - SPACING.paddingTable, ty, { bold: true, size: SIZES.tableHeader, align: 'right' })

    y -= headH
  }

  const needNewPageForRow = () => y - rowH <= M + 180

  drawTableHeader()

  const items = Array.isArray((order as any).items) ? (order as any).items : []
  items.forEach((it: any, idx: number) => {
    if (needNewPageForRow()) {
      newPage()
      y -= 14
      drawSectionTitle('ITENS DO PEDIDO (CONTINUAÇÃO)', M + 4, y + 12)
      y -= 20
      drawTableHeader()
    }

    const isZebra = idx % 2 === 1
    if (isZebra) drawBox(M, y, W, rowH, BRAND.bgZebra)

    const yText = y - 17
    const sku = safeStr(it?.productSnapshot?.sku || it?.sku)
    const name = safeStr(it?.productSnapshot?.name || it?.name)
    const unit = safeStr(it?.productSnapshot?.unit || it?.unit)
    const qty = Number(it?.qty ?? 0)
    const unitPrice = Number(it?.unitPrice ?? 0)
    const subtotal = n2(qty * unitPrice)

    // Truncamento elegante para SKU e Produto
    const skuTruncated = sku.length > 12 ? sku.substring(0, 12) + '…' : sku
    const prodMaxWidth = colWidth.prod - SPACING.paddingTable * 2
    const nameTruncated = truncateText(font, name || '—', SIZES.tableBody, prodMaxWidth)

    drawText(String(idx + 1), col.idx + SPACING.paddingTable, yText, { size: SIZES.tableBody })
    drawText(skuTruncated || '—', col.sku + SPACING.paddingTable, yText, { size: SIZES.tableBody })
    drawText(nameTruncated, col.prod + SPACING.paddingTable, yText, { size: SIZES.tableBody })
    drawText(unit || '—', col.und + SPACING.paddingTable, yText, { size: SIZES.tableBody })
    drawText(String(qty || 0), col.qtdR - SPACING.paddingTable, yText, { size: SIZES.tableBody, align: 'right' })
    drawText(brl(unitPrice), col.unitR - SPACING.paddingTable, yText, { size: SIZES.tableBody, align: 'right' })
    drawText(brl(subtotal), col.subR - SPACING.paddingTable, yText, { size: SIZES.tableBody, align: 'right' })

    y -= rowH
  })

  // ===== TOTALS & NOTES =====
  if (y <= M + 180) newPage()
  y -= SPACING.blockGap

  const totalsBoxW = 240
  const totalsBoxH = 120
  const totalsX = M + W - totalsBoxW

  // Caixa de Totais Refinada
  drawBox(totalsX, y, totalsBoxW, totalsBoxH)
  page.drawRectangle({ x: totalsX, y: y - 24, width: totalsBoxW, height: 24, color: BRAND.primaryDark })
  drawText('TOTAIS', totalsX + SPACING.paddingSmall, y - 15, { bold: true, size: SIZES.sectionTitle, color: BRAND.white })

  const t = (order as any).totals || { subtotal: 0, discount: 0, freight: 0, total: 0 }
  const subtotal = n2(Number(t.subtotal ?? 0))
  const discount = n2(Number(t.discount ?? 0))
  const freight = n2(Number(t.freight ?? 0))
  const total = n2(Number(t.total ?? subtotal - discount + freight))

  const tx = totalsX + SPACING.paddingSmall
  const ty = y - 48

  drawText('Subtotal:', tx, ty, { size: SIZES.totalLabel, color: BRAND.textMuted })
  drawText(brl(subtotal), totalsX + totalsBoxW - SPACING.paddingSmall, ty, { size: SIZES.totalLabel, align: 'right' })

  drawText('Desconto:', tx, ty - 18, { size: SIZES.totalLabel, color: BRAND.textMuted })
  drawText(brl(discount), totalsX + totalsBoxW - SPACING.paddingSmall, ty - 18, { size: SIZES.totalLabel, align: 'right' })

  drawText('Frete:', tx, ty - 36, { size: SIZES.totalLabel, color: BRAND.textMuted })
  drawText(brl(freight), totalsX + totalsBoxW - SPACING.paddingSmall, ty - 36, { size: SIZES.totalLabel, align: 'right' })

  // Separador refinado
  page.drawLine({ 
    start: { x: totalsX + SPACING.paddingSmall, y: ty - 46 }, 
    end: { x: totalsX + totalsBoxW - SPACING.paddingSmall, y: ty - 46 }, 
    thickness: 0.8, 
    color: BRAND.border 
  })

  drawText('TOTAL:', tx, ty - 66, { bold: true, size: SIZES.totalValue, color: BRAND.primary })
  drawText(brl(total), totalsX + totalsBoxW - SPACING.paddingSmall, ty - 66, { 
    bold: true, 
    size: SIZES.totalValue, 
    align: 'right', 
    color: BRAND.primary 
  })

  // Observações com melhor legibilidade
  const notesX = M
  const notesW = W - totalsBoxW - 16
  const notesH = totalsBoxH

  drawBox(notesX, y, notesW, notesH)
  page.drawRectangle({ x: notesX, y: y - 24, width: notesW, height: 24, color: BRAND.bgLight })
  drawText('OBSERVAÇÕES', notesX + SPACING.paddingSmall, y - 15, { bold: true, size: SIZES.sectionTitle, color: BRAND.primaryDark })

  const notes = safeStr((order as any).notes)
  const maxNotesWidth = notesW - SPACING.paddingSmall * 2
  const noteLines = notes ? wrapText(notes, maxNotesWidth, SIZES.bodySmall).slice(0, 6) : ['—']
  let ny = y - 48
  noteLines.forEach((ln) => {
    drawText(ln, notesX + SPACING.paddingSmall, ny, { size: SIZES.bodySmall, maxWidth: maxNotesWidth, color: BRAND.text })
    ny -= SPACING.lineHeight
  })

  y -= totalsBoxH + SPACING.sectionGap

  // ===== FOOTER REFINADO =====
  const footerY = M + 22
  page.drawLine({ 
    start: { x: M, y: footerY + 8 }, 
    end: { x: A4_W - M, y: footerY + 8 }, 
    thickness: 0.5, 
    color: BRAND.border 
  })

  drawText(`Documento gerado em ${formatDatePtBR(Date.now())} • ${FATURANTE.nomeFantasia}`, M, footerY, {
    size: SIZES.footer,
    color: BRAND.textMuted,
  })

  // ===== DOWNLOAD =====
  const pdfBytes = await pdfDoc.save()
  const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer

  const blob = new Blob([ab], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${K}_${docNumber(order, K)}.pdf`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
