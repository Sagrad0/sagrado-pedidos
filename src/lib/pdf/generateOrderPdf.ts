import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

/**
 * PDF:
 * - Cabeçalho estruturado
 * - Blocos de cadastro
 * - Tabela com grid
 * - Caixa de totais
 * - Rodapé
 *
 * 
 */
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

const A4_W = 595.28
const A4_H = 841.89
const M = 28 // margem

function safeStr(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function formatDatePtBR(value: any): string {
  if (!value) return '-'
  const d =
    typeof value === 'number'
      ? new Date(value)
      : value?.toDate
        ? value.toDate()
        : new Date(value)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
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
  if (order.status === 'orcamento') return 'ORCAMENTO'
  return 'PEDIDO'
}

function docNumber(order: Order, kind: PdfKind): string {
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = safeStr(order.orderNumber).trim()
  if (!raw) return prefix
  if (raw.startsWith('PED-') || raw.startsWith('ORC-')) return raw
  return `${prefix}-${raw}`
}

export async function generateOrderPdf(order: Order, kind?: PdfKind) {
  const K = inferKind(order, kind)

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([A4_W, A4_H])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const cText = rgb(0.1, 0.1, 0.1)
  const cMuted = rgb(0.35, 0.35, 0.35)
  const cBorder = rgb(0.15, 0.15, 0.15)
  const cFillHeader = rgb(0.95, 0.95, 0.95)
  const cFillTableHeader = rgb(0.92, 0.92, 0.92)

  const W = A4_W - 2 * M

  const drawBox = (x: number, yTop: number, w: number, h: number, fill?: any) => {
    page.drawRectangle({
      x,
      y: yTop - h,
      width: w,
      height: h,
      borderColor: cBorder,
      borderWidth: 1,
      color: fill,
    })
  }

  const drawText = (
    text: string,
    x: number,
    y: number,
    opts?: { bold?: boolean; size?: number; color?: any; maxWidth?: number; align?: 'left' | 'right' | 'center' }
  ) => {
    const size = opts?.size ?? 9
    const f = opts?.bold ? fontB : font
    const color = opts?.color ?? cText
    const t = safeStr(text)

    if (opts?.align && opts.align !== 'left') {
      const w = f.widthOfTextAtSize(t, size)
      let xx = x
      if (opts.align === 'right') xx = x - w
      if (opts.align === 'center') xx = x - w / 2
      page.drawText(t, { x: xx, y, size, font: f, color, maxWidth: opts?.maxWidth })
      return
    }

    page.drawText(t, { x, y, size, font: f, color, maxWidth: opts?.maxWidth })
  }

  const drawKV = (label: string, value: string, x: number, y: number, w: number) => {
    const L = `${label}:`
    drawText(L, x, y, { bold: true, size: 9 })
    const lw = fontB.widthOfTextAtSize(L, 9)
    drawText(value || '—', x + lw + 4, y, { size: 9, color: cText, maxWidth: w - lw - 4 })
  }

  // ===== HEADER (Mercos-like) =====
  const drawHeader = (yTop: number): number => {
    const h = 86
    drawBox(M, yTop, W, h, cFillHeader)

    const leftX = M + 10
    const rightX = M + W - 10
    const top = yTop - 14

    // Esquerda (marca curta)
    drawText('SAGRADO', leftX, top, { bold: true, size: 14 })
    drawText('Sistema de Pedidos', leftX, top - 16, { size: 9, color: cMuted })

    // Centro (título + número)
    const title = K === 'PEDIDO' ? 'PEDIDO' : 'ORÇAMENTO'
    drawText(title, M + W / 2, top, { bold: true, size: 14, align: 'center' })
    drawText(`Nº ${docNumber(order, K)}`, M + W / 2, top - 16, { bold: true, size: 11, align: 'center' })
    drawText(`Data de Emissão: ${formatDatePtBR(order.createdAt)}`, M + W / 2, top - 32, {
      size: 9,
      align: 'center',
      color: cText,
    })

    // Direita (faturante)
    drawText(FATURANTE.nomeFantasia, rightX, top, { bold: true, size: 11, align: 'right' })
    drawText(FATURANTE.razaoSocial, rightX, top - 12, { size: 8, align: 'right', color: cMuted })
    drawText(`CNPJ: ${FATURANTE.cnpj}  |  IE: ${FATURANTE.ie}`, rightX, top - 24, { size: 8, align: 'right' })
    drawText(FATURANTE.endereco, rightX, top - 36, { size: 8, align: 'right', maxWidth: 230 })
    drawText(`${FATURANTE.cidade}/${FATURANTE.uf}`, rightX, top - 48, { size: 8, align: 'right' })
    drawText(`${FATURANTE.telefone}  |  ${FATURANTE.email}`, rightX, top - 60, {
      size: 8,
      align: 'right',
      maxWidth: 230,
    })

    return yTop - h - 14
  }

  let y = A4_H - M
  y = drawHeader(y)

  const newPage = () => {
    page = pdfDoc.addPage([A4_W, A4_H])
    y = A4_H - M
    y = drawHeader(y)
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

  // ===== BLOCO CLIENTE =====
  const blockH = 92
  drawBox(M, y, W, blockH)

  const x1 = M + 10
  const x2 = M + W / 2 + 10
  const topY = y - 16

  drawText('DADOS DO CLIENTE', x1, topY + 16, { bold: true, size: 10 })

  const c = order.customerSnapshot
  const cName = safeStr(c?.name)
  const cDoc = safeStr(c?.doc)
  const cPhone = safeStr(c?.phone)
  const cEmail = safeStr(c?.email)
  const cAddr = safeStr(c?.address)

  drawKV('Cliente', cName, x1, topY, W / 2 - 20)
  drawKV('Documento', cDoc, x1, topY - 12, W / 2 - 20)
  drawKV('Telefone', cPhone, x1, topY - 24, W / 2 - 20)

  drawKV('E-mail', cEmail, x2, topY, W / 2 - 20)
  drawKV('Endereço', cAddr, x2, topY - 12, W / 2 - 20)

  y = y - blockH - 14

  // ===== TABELA (GRID) =====
  drawText('ITENS', M, y - 2, { bold: true, size: 10 })
  y -= 14

  const col = {
    idx: M + 6,
    sku: M + 40,
    prod: M + 140,
    und: M + 380,
    qtd: M + 420,
    unit: M + 505,
    sub: M + W - 6,
  }

  const rowH = 18
  const tableHeaderH = 22

  const gridXs = [M, col.sku - 10, col.prod - 10, col.und - 10, col.qtd - 10, col.unit - 10, M + W]

  const drawTableHeader = () => {
    drawBox(M, y, W, tableHeaderH, cFillTableHeader)

    const ty = y - 15
    drawText('#', col.idx, ty, { bold: true, size: 9 })
    drawText('Código', col.sku, ty, { bold: true, size: 9 })
    drawText('Produto', col.prod, ty, { bold: true, size: 9 })
    drawText('Unid.', col.und, ty, { bold: true, size: 9 })
    drawText('Qtde.', col.qtd, ty, { bold: true, size: 9 })
    drawText('Preço', col.unit, ty, { bold: true, size: 9, align: 'right' })
    drawText('Subtotal', col.sub, ty, { bold: true, size: 9, align: 'right' })

    const y0 = y - tableHeaderH
    const y1 = y
    gridXs.forEach((x) => page.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness: 1, color: cBorder }))

    y -= tableHeaderH
  }

  const needNewPageForRow = () => y - rowH <= M + 190

  drawTableHeader()

  const items = Array.isArray(order.items) ? order.items : []
  items.forEach((it, idx) => {
    if (needNewPageForRow()) {
      newPage()
      y -= 8
      drawText('ITENS (continuação)', M, y - 2, { bold: true, size: 10 })
      y -= 14
      drawTableHeader()
    }

    drawBox(M, y, W, rowH)

    const yText = y - 13
    const sku = safeStr(it?.productSnapshot?.sku || (it as any)?.sku)
    const name = safeStr(it?.productSnapshot?.name || (it as any)?.name)
    const unit = safeStr(it?.productSnapshot?.unit || (it as any)?.unit)
    const qty = Number((it as any)?.qty ?? 0)
    const unitPrice = Number((it as any)?.unitPrice ?? 0)
    const subtotal = n2(qty * unitPrice)

    drawText(String(idx + 1), col.idx, yText, { size: 9 })
    drawText(sku || '—', col.sku, yText, { size: 9 })
    drawText(name || '—', col.prod, yText, { size: 9, maxWidth: col.und - col.prod - 14 })
    drawText(unit || '—', col.und, yText, { size: 9 })
    drawText(String(qty || 0), col.qtd, yText, { size: 9 })
    drawText(brl(unitPrice), col.unit, yText, { size: 9, align: 'right' })
    drawText(brl(subtotal), col.sub, yText, { size: 9, align: 'right' })

    const y0 = y - rowH
    const y1 = y
    gridXs.forEach((x) => page.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness: 1, color: cBorder }))

    y -= rowH
  })

  // ===== TOTAIS + OBS =====
  if (y <= M + 190) newPage()

  y -= 12

  const totalsBoxW = 220
  const totalsBoxH = 92
  const totalsX = M + W - totalsBoxW

  drawBox(totalsX, y, totalsBoxW, totalsBoxH)
  drawText('TOTAIS', totalsX + 10, y - 14, { bold: true, size: 10 })

  const t = order.totals || { subtotal: 0, discount: 0, freight: 0, total: 0 }
  const subtotal = n2(Number((t as any).subtotal ?? 0))
  const discount = n2(Number((t as any).discount ?? 0))
  const freight = n2(Number((t as any).freight ?? 0))
  const total = n2(Number((t as any).total ?? subtotal - discount + freight))

  const tx = totalsX + 10
  const ty = y - 30

  drawText('Subtotal:', tx, ty, { size: 9 })
  drawText(brl(subtotal), totalsX + totalsBoxW - 10, ty, { size: 9, align: 'right' })

  drawText('Desconto:', tx, ty - 14, { size: 9 })
  drawText(brl(discount), totalsX + totalsBoxW - 10, ty - 14, { size: 9, align: 'right' })

  drawText('Frete:', tx, ty - 28, { size: 9 })
  drawText(brl(freight), totalsX + totalsBoxW - 10, ty - 28, { size: 9, align: 'right' })

  page.drawLine({
    start: { x: totalsX + 10, y: ty - 36 },
    end: { x: totalsX + totalsBoxW - 10, y: ty - 36 },
    thickness: 1,
    color: cBorder,
  })

  drawText('TOTAL:', tx, ty - 52, { bold: true, size: 10 })
  drawText(brl(total), totalsX + totalsBoxW - 10, ty - 52, { bold: true, size: 10, align: 'right' })

  const notesX = M
  const notesW = W - totalsBoxW - 12
  const notesH = totalsBoxH

  drawBox(notesX, y, notesW, notesH)
  drawText('OBSERVAÇÕES', notesX + 10, y - 14, { bold: true, size: 10 })

  const notes = safeStr(order.notes)
  const maxNotesWidth = notesW - 20
  const noteLines = notes ? wrapText(notes, maxNotesWidth, 9).slice(0, 5) : ['—']
  let ny = y - 30
  noteLines.forEach((ln) => {
    drawText(ln, notesX + 10, ny, { size: 9, maxWidth: maxNotesWidth })
    ny -= 12
  })

  y -= totalsBoxH + 16

  // ===== RODAPÉ =====
  const footerY = M + 22

  page.drawLine({
    start: { x: M, y: footerY + 10 },
    end: { x: A4_W - M, y: footerY + 10 },
    thickness: 1,
    color: cBorder,
  })

  drawText(`Gerado em ${formatDatePtBR(Date.now())} • ${FATURANTE.nomeFantasia}`, M, footerY, { size: 8, color: cMuted })

  // Download (fix TS on Vercel: ensure BlobPart is ArrayBuffer, not ArrayBufferLike)
  const pdfBytes = await pdfDoc.save()

  // Convert Uint8Array<ArrayBufferLike> -> ArrayBuffer
  const ab = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer

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
