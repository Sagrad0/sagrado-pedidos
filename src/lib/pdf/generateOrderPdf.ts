import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

/**
 * PDF profissional com layout refinado e corrigido:
 * - Cabeçalho reorganizado: Número/data à esquerda, CDA à direita
 * - Tabela com proporções ajustadas e padding correto
 * - Todos os elementos respeitam os limites da página
 * - Tipografia otimizada e espaçamento profissional
 */

// >>>> EDITAR AQUI (dados da CDA) <<<<
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

// === BRAND COLORS ===
const BRAND = {
  primary: rgb(0x45 / 255, 0x00 / 255, 0x57 / 255),      // #450057
  primaryDark: rgb(0x30 / 255, 0x00 / 255, 0x3d / 255),  // #30003d
  success: rgb(0.0, 0.6, 0.0),                           // Verde para totais
  bgLight: rgb(0.98, 0.98, 0.98),                         // Fundo suave
  bgZebra: rgb(0.985, 0.985, 0.985),
  text: rgb(0.08, 0.08, 0.08),                           // Texto principal
  textMuted: rgb(0.45, 0.45, 0.45),                       // Texto secundário
  border: rgb(0.85, 0.85, 0.85),                         // Bordas suaves
  white: rgb(1, 1, 1),
}

// === LAYOUT CONSTANTS ===
const A4_W = 595.28
const A4_H = 841.89
const M = 36   // Margem profissional

function safeStr(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function formatDatePtBR(value: any): string {
  if (!value) return '-'
  const d = typeof value === 'number' ? new Date(value) : value?.toDate ? value.toDate() : new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function brl(v: number): string {
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function n2(v: number): number {
  const n = Number.isFinite(v) ? v : 0
  return Math.round(n * 100) / 100
}

function inferKind(order: Order, kind?: PdfKind): PdfKind {
  if (kind) return kind
  if ((order as any).status === 'orcamento') return 'ORCAMENTO'
  return 'PEDIDO'
}

function docNumber(order: Order, kind: PdfKind): string {
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = safeStr((order as any).orderNumber).trim()
  if (!raw) return prefix
  if (raw.startsWith('PED-') || raw.startsWith('ORC-')) return raw
  return `${prefix}-${raw}`
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
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: fill, borderColor: border ? BRAND.border : undefined, borderWidth: border ? 0.8 : 0 })
  }

  const drawText = (text: string, x: number, y: number, opts?: { bold?: boolean; size?: number; color?: any; maxWidth?: number; align?: 'left' | 'right' | 'center' }) => {
    const size = opts?.size ?? 9
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
    drawText(title, x, yTop - 12, { bold: true, size: 10.5, color: BRAND.primaryDark })
  }

  const drawKV = (label: string, value: string, x: number, y: number, w: number) => {
    const L = `${label}:`
    drawText(L, x, y, { bold: true, size: 9, color: BRAND.text })
    const lw = fontB.widthOfTextAtSize(L, 9)
    drawText(value || '—', x + lw + 4, y, { size: 9, color: BRAND.text, maxWidth: w - lw - 4 })
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
    const brandH = 52
    page.drawRectangle({ x: M, y: yTop - brandH, width: W, height: brandH, color: BRAND.primary })

    const title = K === 'PEDIDO' ? 'PEDIDO DE VENDA' : 'ORÇAMENTO'
    drawText(title, M + W / 2, yTop - 32, { bold: true, size: 16, align: 'center', color: BRAND.white })

    const h = 90
    const topBoxY = yTop - brandH - 14
    drawBox(M, topBoxY, W, h, BRAND.bgLight)

    // ESQUERDA: Número e Data de Emissão
    const leftInfoX = M + 12
    drawText(`Nº ${docNumber(order, K)}`, leftInfoX, topBoxY - 35, { bold: true, size: 13 })
    drawText(`Data de Emissão: ${formatDatePtBR((order as any).createdAt)}`, leftInfoX, topBoxY - 53, { size: 9.5, color: BRAND.textMuted })

    // DIREITA: Faturante (com maxWidth para evitar quebra)
    const rightX = M + W - 14
    const maxWidthRight = 180 // LIMITE para não extrapolar
    
    drawText(FATURANTE.nomeFantasia, rightX, topBoxY - 25, { bold: true, size: 11, align: 'right', maxWidth: maxWidthRight })
    drawText(FATURANTE.razaoSocial, rightX, topBoxY - 40, { size: 8.5, align: 'right', color: BRAND.textMuted, maxWidth: maxWidthRight })
    drawText(`CNPJ: ${FATURANTE.cnpj}`, rightX, topBoxY - 54, { size: 8.5, align: 'right', maxWidth: maxWidthRight })
    drawText(`IE: ${FATURANTE.ie}`, rightX, topBoxY - 66, { size: 8.5, align: 'right', maxWidth: maxWidthRight })
    drawText(`${FATURANTE.cidade}/${FATURANTE.uf} • ${FATURANTE.telefone}`, rightX, topBoxY - 78, { size: 8.5, align: 'right', maxWidth: maxWidthRight })
    drawText(FATURANTE.email, rightX, topBoxY - 90, { size: 8.5, align: 'right', maxWidth: maxWidthRight })

    return topBoxY - h - 18
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

  const blockH = 98
  drawBox(M, y, W, blockH)

  drawSectionTitle('DADOS DO CLIENTE', M + 12, y)

  const x1 = M + 12
  const x2 = M + W / 2 + 12
  const topY = y - 36

  drawKV('Cliente', cName, x1, topY, W / 2 - 24)
  drawKV('Documento', cDoc, x1, topY - 16, W / 2 - 24)
  drawKV('Telefone', cPhone, x1, topY - 32, W / 2 - 24)

  drawKV('E-mail', cEmail, x2, topY, W / 2 - 24)

  const addrLabel = 'Endereço:'
  drawText(addrLabel, x2, topY - 16, { bold: true, size: 9 })
  const lw = fontB.widthOfTextAtSize(addrLabel, 9)
  const addrLines = cAddr ? wrapText(cAddr, (W / 2 - 24) - lw - 4, 9).slice(0, 2) : ['—']
  drawText(addrLines[0], x2 + lw + 4, topY - 16, { size: 9, maxWidth: W / 2 - 24 - lw - 4 })
  if (addrLines[1]) drawText(addrLines[1], x2 + lw + 4, topY - 28, { size: 9, maxWidth: W / 2 - 24 - lw - 4 })

  y -= blockH + 22

  // ===== TABLE =====
  drawSectionTitle('ITENS DO PEDIDO', M + 2, y + 10)
  y -= 16

  // Colunas otimizadas com padding adequado
  const col = {
    idx: M + 10,
    sku: M + 42,
    prod: M + 135,
    und: M + 360,
    qtdR: M + 412,
    unitR: M + 472,
    subR: M + 538,  // Ajustado para não colar na borda (era 542)
  }

  const rowH = 20
  const headH = 26

  const drawTableHeader = () => {
    drawBox(M, y, W, headH, BRAND.bgLight)

    const ty = y - 17
    drawText('#', col.idx, ty, { bold: true, size: 9.5 })
    drawText('Código', col.sku, ty, { bold: true, size: 9.5 })
    drawText('Produto', col.prod, ty, { bold: true, size: 9.5 })
    drawText('Unid.', col.und, ty, { bold: true, size: 9.5 })
    drawText('Qtde.', col.qtdR, ty, { bold: true, size: 9.5, align: 'right' })
    drawText('Preço Unit.', col.unitR, ty, { bold: true, size: 9.5, align: 'right' })
    drawText('Subtotal', col.subR, ty, { bold: true, size: 9.5, align: 'right' })

    y -= headH
  }

  const needNewPageForRow = () => y - rowH <= M + 180

  drawTableHeader()

  const items = Array.isArray((order as any).items) ? (order as any).items : []
  items.forEach((it: any, idx: number) => {
    if (needNewPageForRow()) {
      newPage()
      y -= 12
      drawSectionTitle('ITENS DO PEDIDO (CONTINUAÇÃO)', M + 2, y + 10)
      y -= 16
      drawTableHeader()
    }

    const isZebra = idx % 2 === 1
    if (isZebra) drawBox(M, y, W, rowH, BRAND.bgZebra)

    const yText = y - 14
    const sku = safeStr(it?.productSnapshot?.sku || it?.sku)
    const name = safeStr(it?.productSnapshot?.name || it?.name)
    const unit = safeStr(it?.productSnapshot?.unit || it?.unit)
    const qty = Number(it?.qty ?? 0)
    const unitPrice = Number(it?.unitPrice ?? 0)
    const subtotal = n2(qty * unitPrice)

    drawText(String(idx + 1), col.idx, yText, { size: 9.5 })
    drawText(sku || '—', col.sku, yText, { size: 9.5 })
    drawText(name || '—', col.prod, yText, { size: 9.5, maxWidth: col.und - col.prod - 10 })
    drawText(unit || '—', col.und, yText, { size: 9.5 })
    drawText(String(qty || 0), col.qtdR, yText, { size: 9.5, align: 'right' })
    drawText(brl(unitPrice), col.unitR, yText, { size: 9.5, align: 'right' })
    drawText(brl(subtotal), col.subR, yText, { size: 9.5, align: 'right' })

    y -= rowH
  })

  // ===== TOTALS & NOTES =====
  if (y <= M + 180) newPage()
  y -= 18

  const totalsBoxW = 240
  const totalsBoxH = 110
  const totalsX = M + W - totalsBoxW

  // Caixa de Totais
  drawBox(totalsX, y, totalsBoxW, totalsBoxH)
  page.drawRectangle({ x: totalsX, y: y - 20, width: totalsBoxW, height: 20, color: BRAND.primaryDark })
  drawText('TOTAIS', totalsX + 12, y - 14, { bold: true, size: 11, color: BRAND.white })

  const t = (order as any).totals || { subtotal: 0, discount: 0, freight: 0, total: 0 }
  const subtotal = n2(Number(t.subtotal ?? 0))
  const discount = n2(Number(t.discount ?? 0))
  const freight = n2(Number(t.freight ?? 0))
  const total = n2(Number(t.total ?? subtotal - discount + freight))

  const tx = totalsX + 12
  const ty = y - 44

  drawText('Subtotal:', tx, ty, { size: 10 })
  drawText(brl(subtotal), totalsX + totalsBoxW - 12, ty, { size: 10, align: 'right' })

  drawText('Desconto:', tx, ty - 16, { size: 10 })
  drawText(brl(discount), totalsX + totalsBoxW - 12, ty - 16, { size: 10, align: 'right' })

  drawText('Frete:', tx, ty - 32, { size: 10 })
  drawText(brl(freight), totalsX + totalsBoxW - 12, ty - 32, { size: 10, align: 'right' })

  page.drawLine({ start: { x: totalsX + 12, y: ty - 40 }, end: { x: totalsX + totalsBoxW - 12, y: ty - 40 }, thickness: 1, color: BRAND.border })

  drawText('TOTAL:', tx, ty - 58, { bold: true, size: 13, color: BRAND.primary })
  drawText(brl(total), totalsX + totalsBoxW - 12, ty - 58, { bold: true, size: 13, align: 'right', color: BRAND.primary })

  // Observações
  const notesX = M
  const notesW = W - totalsBoxW - 16
  const notesH = totalsBoxH

  drawBox(notesX, y, notesW, notesH)
  page.drawRectangle({ x: notesX, y: y - 20, width: notesW, height: 20, color: BRAND.bgLight })
  drawText('OBSERVAÇÕES', notesX + 12, y - 14, { bold: true, size: 10.5, color: BRAND.primaryDark })

  const notes = safeStr((order as any).notes)
  const maxNotesWidth = notesW - 24
  const noteLines = notes ? wrapText(notes, maxNotesWidth, 9.5).slice(0, 6) : ['—']
  let ny = y - 44
  noteLines.forEach((ln) => {
    drawText(ln, notesX + 12, ny, { size: 9.5, maxWidth: maxNotesWidth })
    ny -= 12
  })

  y -= totalsBoxH + 24

  // ===== FOOTER =====
  const footerY = M + 24
  page.drawLine({ start: { x: M, y: footerY + 10 }, end: { x: A4_W - M, y: footerY + 10 }, thickness: 0.8, color: BRAND.border })

  drawText(`Documento gerado em ${formatDatePtBR(Date.now())} • ${FATURANTE.nomeFantasia}`, M, footerY, {
    size: 8.5,
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
