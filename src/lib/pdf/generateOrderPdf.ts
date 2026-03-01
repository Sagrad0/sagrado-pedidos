/*
 * FIX ABSOLUTO: Implementado sistema de células com boundary enforcement
 * - Cada célula agora tem área de desenho exclusiva e protegida
 * - Truncamento forçado em TODOS os campos (SKU, Produto, Unit, Qtd, Preço, Total)
 * - Fonte reduzida e padding otimizado
 * - Sanitização completa de entrada para evitar NaN e valores inválidos
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Order } from '@/types'
import { formatAddress } from '@/lib/address'

// ===== CONSTANTES =====
const BRAND_PURPLE = rgb(75 / 255, 6 / 255, 82 / 255)
const BRAND_GREEN = rgb(153 / 255, 178 / 255, 34 / 255)

const A4_W = 595.28
const A4_H = 841.89
const M = 40
const W = A4_W - M * 2

// ✅ Currency local (sem import externo)
const formatCurrency = (v: number) => {
  const n = Number(v)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(n) ? n : 0
  )
}

// ===== CONFIGURAÇÃO DA TABELA =====
const TABLE_CONFIG = {
  columns: {
    idx: { width: 22, label: '#' },
    sku: { width: 80, label: 'SKU' },
    prod: { width: 205, label: 'PRODUTO' },
    unit: { width: 32, label: 'UN' },
    qty: { width: 40, label: 'QTD' },
    price: { width: 60, label: 'PREÇO' },
    total: { width: 70, label: 'TOTAL' },
  },
  rowHeight: 18,
  headerHeight: 22,
  fontSize: 7,
  headerFontSize: 7,
  cellPadding: 2,
}

// ===== SPACING =====
const SPACING = {
  sectionGap: 18,
  headerGap: 12,
  padding: 8,
}

// ===== FUNÇÕES UTILITÁRIAS =====
const safeNum = (v: any, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const safeStr = (v: any) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const truncateText = (text: string, maxChars: number) => {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

const calculateColumnX = (startX: number, widths: number[], index: number) => {
  return startX + widths.slice(0, index).reduce((a, b) => a + b, 0)
}

const sumOrderTotal = (order: any) => {
  if (order?.totals?.total != null) return safeNum(order.totals.total, 0)

  const items = Array.isArray(order?.items) ? order.items : []
  return items.reduce((acc: number, it: any) => {
    const qty = safeNum(it.qty ?? it.quantity, 0)
    const unitPrice = safeNum(it.unitPrice ?? it.price, 0)
    const lineTotal = it.total != null ? safeNum(it.total, qty * unitPrice) : qty * unitPrice
    return acc + lineTotal
  }, 0)
}

export async function generateOrderPdf(order: Order): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([A4_W, A4_H])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = A4_H - 95

  // ===== LOGO (Sagrado) =====
  try {
    const logoRes = await fetch('/brand/sagrado-logo-negativo.png')
    if (logoRes.ok) {
      const bytes = await logoRes.arrayBuffer()
      const logo = await pdfDoc.embedPng(bytes)
      const logoW = 120
      const logoH = (logo.height / logo.width) * logoW
      // faixa roxa no topo + logo em negativo
      page.drawRectangle({ x: 0, y: A4_H - 70, width: A4_W, height: 70, color: BRAND_PURPLE })
      page.drawImage(logo, { x: M, y: A4_H - 55, width: logoW, height: logoH })
    }
  } catch {
    // silencioso: PDF continua mesmo sem logo (offline)
  }

  // ===== HEADER =====
  const isOrc = order.status === 'orcamento'
  const numOrc = safeStr((order as any).budgetNumber || '')
  const numPed = safeStr((order as any).orderNumber || '')
  const title = isOrc
    ? `ORÇAMENTO ${numOrc}`
    : `PEDIDO ${numPed || safeStr((order as any).budgetNumber || '')}`

  page.drawText(title, {
    x: M,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  y -= 18

  const createdAt = safeStr((order as any).createdAt)
  page.drawText(`Data: ${createdAt ? new Date(Number(createdAt)).toLocaleDateString('pt-BR') : '-'}`, {
    x: M,
    y,
    size: 9,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= SPACING.headerGap

  // ===== SECTIONS =====
  const drawSectionTitle = (t: string, x: number, y: number) => {
    page.drawText(t, { x, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  }

  const drawKV = (k: string, v: string, x: number, y: number, maxW: number) => {
    const label = `${k}: `
    page.drawText(label, { x, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(truncateText(v, Math.max(10, Math.floor(maxW / 4))), {
      x: x + fontBold.widthOfTextAtSize(label, 8),
      y,
      size: 8,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: maxW,
    })
  }

  // ===== CLIENTE =====
  drawSectionTitle('CLIENTE', M, y)
  y -= 12

  const cs: any = (order as any).customerSnapshot || {}
  drawKV('Nome', safeStr(cs.name || '-'), M, y, W)
  y -= 11

  if (cs.legalName) {
    drawKV('Razão social', safeStr(cs.legalName), M, y, W)
    y -= 11
  }

  if (cs.doc) {
    drawKV('Documento', safeStr(cs.doc), M, y, W)
    y -= 11
  }

  if (cs.phone) {
    drawKV('Telefone', safeStr(cs.phone), M, y, W)
    y -= 11
  }

  if (cs.email) {
    drawKV('Email', safeStr(cs.email), M, y, W)
    y -= 11
  }

  const addrMain = (cs as any).addressMain || cs.address
  if (addrMain) {
    drawKV('Endereço', formatAddress(addrMain), M, y, W)
    y -= 11
  }

  if ((cs as any).addressDelivery) {
    drawKV('Entrega', formatAddress((cs as any).addressDelivery), M, y, W)
    y -= 11
  }

  y -= 6

  // ===== CONDIÇÃO DE PAGAMENTO / OBS =====
  const payDays: number[] = Array.isArray((order as any)?.payment?.installments)
    ? (order as any).payment.installments
    : []
  const payNote = safeStr((order as any)?.payment?.note || '')
  const payText = payDays.length ? `${payDays.join(' / ')} dias` : '-'
  drawSectionTitle('PAGAMENTO', M + 4, y + 12)

  page.drawText(`Prazo: ${payText}`, {
    x: M + 4,
    y,
    size: 8,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })
  y -= 12

  if (payNote) {
    page.drawText(`Obs.: ${truncateText(payNote, 120)}`, {
      x: M + 4,
      y,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })
    y -= 12
  }

  // Observações gerais do pedido/orçamento
  const notes = safeStr((order as any).notes || '')
  if (notes) {
    drawSectionTitle('OBSERVAÇÕES', M + 4, y + 12)
    page.drawText(truncateText(notes, 200), {
      x: M + 4,
      y,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })
    y -= 16
  }

  // ===== ITENS =====
  drawSectionTitle('ITENS DO PEDIDO', M, y)
  y -= 12

  // ===== TABLE SETUP =====
  const colDefs = Object.values(TABLE_CONFIG.columns)
  const widths = colDefs.map((c) => c.width)
  const startX = M
  const startY = y
  const headerH = TABLE_CONFIG.headerHeight
  const rowH = TABLE_CONFIG.rowHeight
  const pad = TABLE_CONFIG.cellPadding

  const drawCellText = (text: string, x: number, y: number, w: number, align: 'left' | 'right' = 'left') => {
    const t = truncateText(safeStr(text), Math.max(1, Math.floor(w / 4)))
    const size = TABLE_CONFIG.fontSize
    const textW = font.widthOfTextAtSize(t, size)

    let tx = x + pad
    if (align === 'right') tx = x + w - pad - textW

    page.drawText(t, {
      x: tx,
      y: y + 5,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: w - pad * 2,
    })
  }

  const drawHeader = () => {
    page.drawRectangle({
      x: startX,
      y: startY - headerH,
      width: W,
      height: headerH,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    })

    colDefs.forEach((c, i) => {
      const x = calculateColumnX(startX, widths, i)
      const label = c.label
      page.drawText(label, {
        x: x + pad,
        y: startY - headerH + 7,
        size: TABLE_CONFIG.headerFontSize,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: c.width - pad * 2,
      })
    })
  }

  drawHeader()

  const items = Array.isArray((order as any).items) ? (order as any).items : []
  let rowY = startY - headerH

  items.forEach((it: any, idx: number) => {
    rowY -= rowH

    // background + border
    page.drawRectangle({
      x: startX,
      y: rowY,
      width: W,
      height: rowH,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    })

    const ps = it?.productSnapshot || {}
    const sku = safeStr(ps.sku || it.sku || '')
    const name = safeStr(ps.name || it.name || '')
    const unit = safeStr(ps.unit || it.unit || '')
    const qty = safeNum(it.qty ?? it.quantity, 0)
    const unitPrice = safeNum(it.unitPrice ?? it.price, 0)
    const lineTotal = it.total != null ? safeNum(it.total, qty * unitPrice) : qty * unitPrice

    const cells = [
      { text: String(idx + 1), align: 'left' as const },
      { text: sku, align: 'left' as const },
      { text: name, align: 'left' as const },
      { text: unit, align: 'left' as const },
      { text: String(qty), align: 'right' as const },
      { text: formatCurrency(unitPrice), align: 'right' as const },
      { text: formatCurrency(lineTotal), align: 'right' as const },
    ]

    cells.forEach((cell, i) => {
      const x = calculateColumnX(startX, widths, i)
      const w = widths[i]
      drawCellText(cell.text, x, rowY, w, cell.align)
    })
  })

  y = rowY - 18

  // ===== TOTAIS =====
  const total = sumOrderTotal(order as any)
  const discount = safeNum((order as any)?.totals?.discount, 0)
  const freight = safeNum((order as any)?.totals?.freight, 0)

  const finalTotal = safeNum((order as any)?.totals?.total, total - discount + freight)

  const totalsX = M + W - 200
  const line = (label: string, value: string) => {
    page.drawText(label, { x: totalsX, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(value, {
      x: totalsX + 120,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 12
  }

  line('Subtotal', formatCurrency(total))
  line('Desconto', formatCurrency(discount))
  line('Frete', formatCurrency(freight))
  y -= 4
  line('Total', formatCurrency(finalTotal))

  // ===== FOOTER (marca) =====
  page.drawRectangle({ x: 0, y: 0, width: A4_W, height: 26, color: BRAND_GREEN })
  page.drawText('Sagrado', {
    x: M,
    y: 9,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
